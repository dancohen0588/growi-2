/**
 * Transport HTTP du client API : jetons, enveloppes `{ data }` / `{ error }`,
 * et rejeu unique de la requête après un rafraîchissement de jeton.
 */

import { ApiError, CLIENT_ERROR_CODES } from './errors'

export interface ApiClientOptions {
  /** Racine de l'API, avec ou sans `/` final (ex. `https://growi.app`). */
  baseUrl: string
  /**
   * Jeton d'accès à placer dans l'en-tête `Authorization`.
   * Branché sur expo-secure-store en phase 3 ; laisser vide côté web, où
   * l'authentification passe par les cookies de session.
   */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>
  /**
   * Appelé sur un 401. Renvoyer `true` après avoir obtenu un nouveau jeton
   * pour que la requête soit rejouée une fois ; `false` pour laisser
   * l'erreur remonter (déconnexion).
   */
  onUnauthorized?: () => boolean | Promise<boolean>
  /** Implémentation de `fetch` à utiliser — injectable pour les tests. */
  fetch?: typeof fetch
  /** En-têtes ajoutés à chaque requête. */
  defaultHeaders?: Record<string, string>
  /**
   * Envoyer les cookies. `'include'` côté web pour réutiliser la session
   * NextAuth ; inutile en mobile, où le jeton suffit.
   */
  credentials?: RequestCredentials
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  headers?: Record<string, string>
}

export class HttpClient {
  private readonly options: ApiClientOptions
  private readonly fetchImpl: typeof fetch

  constructor(options: ApiClientOptions) {
    this.options = options
    const impl = options.fetch ?? globalThis.fetch
    if (!impl) {
      throw new Error(
        "Aucune implémentation de fetch disponible : passez-en une via l'option `fetch`.",
      )
    }
    // Certaines implémentations exigent d'être appelées liées à leur contexte.
    this.fetchImpl = impl.bind(globalThis)
  }

  get baseUrl(): string {
    return this.options.baseUrl.replace(/\/+$/, '')
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send(path, options)

    // 401 : on laisse une chance au rafraîchissement, puis on rejoue une fois.
    if (response.status === 401 && this.options.onUnauthorized) {
      const refreshed = await this.options.onUnauthorized()
      if (refreshed) {
        return this.readBody<T>(await this.send(path, options))
      }
    }

    return this.readBody<T>(response)
  }

  /**
   * Lit une réponse `text/event-stream` et rend ses événements au fil de l'eau.
   *
   * Le découpage du réseau n'a rien à voir avec celui des événements : un
   * paquet peut couper une ligne en deux, ou en apporter cinq d'un coup. Le
   * tampon ci-dessous est donc la seule chose qui garantit qu'on ne rend que
   * des événements entiers.
   *
   * Un statut d'erreur est lu comme une réponse ordinaire et levé en
   * `ApiError` — c'est ainsi que le 429 du quota arrive à l'appelant, avant
   * tout événement.
   */
  async *stream(
    path: string,
    options: RequestOptions = {},
  ): AsyncGenerator<{ event: string; data: unknown }> {
    const streamOptions: RequestOptions = {
      ...options,
      headers: { accept: 'text/event-stream', ...options.headers },
    }

    let response = await this.send(path, streamOptions)

    if (response.status === 401 && this.options.onUnauthorized) {
      const refreshed = await this.options.onUnauthorized()
      if (refreshed) response = await this.send(path, streamOptions)
    }

    // Lève sur tout ce qui n'est pas un 2xx, avec le code de l'API.
    if (!response.ok) await this.readBody(response)

    if (!response.body) {
      throw new ApiError(
        response.status,
        CLIENT_ERROR_CODES.INVALID_RESPONSE,
        'Le serveur n’a pas ouvert de flux.',
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let separator = buffer.indexOf('\n\n')
        while (separator !== -1) {
          const block = buffer.slice(0, separator)
          buffer = buffer.slice(separator + 2)
          const parsed = parseSseBlock(block)
          if (parsed) yield parsed
          separator = buffer.indexOf('\n\n')
        }
      }

      // Un dernier bloc que le serveur n'aurait pas terminé par une ligne vide.
      const last = parseSseBlock(buffer + decoder.decode())
      if (last) yield last
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(0, CLIENT_ERROR_CODES.ABORTED, 'Requête annulée.')
      }
      throw new ApiError(
        0,
        CLIENT_ERROR_CODES.NETWORK,
        'La connexion a été interrompue pendant la réponse.',
      )
    } finally {
      reader.releaseLock()
    }
  }

  private async send(path: string, options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...this.options.defaultHeaders,
      ...options.headers,
    }

    const token = await this.options.getAccessToken?.()
    if (token) headers.authorization = `Bearer ${token}`

    const hasBody = options.body !== undefined

    // Un `FormData` part tel quel : c'est le moteur HTTP qui pose le
    // `Content-Type`, avec la frontière multipart qu'il vient de tirer. La
    // fixer nous-mêmes rendrait le corps illisible.
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData

    if (hasBody && !isFormData) headers['content-type'] = 'application/json'

    try {
      return await this.fetchImpl(this.buildUrl(path, options.query), {
        method: options.method ?? 'GET',
        headers,
        body: !hasBody ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
        signal: options.signal,
        ...(this.options.credentials ? { credentials: this.options.credentials } : {}),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(0, CLIENT_ERROR_CODES.ABORTED, 'Requête annulée.')
      }
      throw new ApiError(
        0,
        CLIENT_ERROR_CODES.NETWORK,
        'Impossible de joindre Growi. Vérifie ta connexion.',
      )
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    if (!query) return url

    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value))
    }
    const qs = params.toString()
    return qs ? `${url}?${qs}` : url
  }

  /** Déballe l'enveloppe de l'API, ou lève une `ApiError` circonstanciée. */
  private async readBody<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T

    const raw = await response.text()
    let parsed: unknown
    if (raw.length > 0) {
      try {
        parsed = JSON.parse(raw)
      } catch {
        if (response.ok) {
          throw new ApiError(
            response.status,
            CLIENT_ERROR_CODES.INVALID_RESPONSE,
            'Réponse illisible du serveur.',
            raw,
          )
        }
        throw new ApiError(response.status, String(response.status), httpMessage(response), raw)
      }
    }

    if (!response.ok) {
      const error = (parsed as { error?: { code?: string; message?: string } } | undefined)?.error
      throw new ApiError(
        response.status,
        error?.code ?? String(response.status),
        error?.message ?? httpMessage(response),
        parsed,
      )
    }

    if (parsed === undefined || !isRecord(parsed) || !('data' in parsed)) {
      throw new ApiError(
        response.status,
        CLIENT_ERROR_CODES.INVALID_RESPONSE,
        "Réponse inattendue du serveur : enveloppe { data } absente.",
        parsed,
      )
    }

    return parsed.data as T
  }
}

/**
 * Un bloc SSE — les lignes séparées par une ligne vide — en événement.
 *
 * Rend `null` sur ce qui ne porte pas de données : ligne de commentaire
 * (« : ping », que certains proxys insèrent pour garder la connexion), bloc
 * vide, ou `data` illisible. Rien de tout cela n'est une panne.
 */
function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = 'message'
  const dataLines: string[] = []

  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (line === '' || line.startsWith(':')) continue

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')

    if (field === 'event') event = value
    // La spec SSE autorise plusieurs lignes `data:` pour un même événement.
    else if (field === 'data') dataLines.push(value)
  }

  if (dataLines.length === 0) return null

  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function httpMessage(response: Response): string {
  return response.statusText || `Erreur HTTP ${response.status}`
}
