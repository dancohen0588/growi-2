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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function httpMessage(response: Response): string {
  return response.statusText || `Erreur HTTP ${response.status}`
}
