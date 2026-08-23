/**
 * Client typé de l'API Growi v1.
 *
 * Une méthode par endpoint, avec les types de `@growi/shared` en entrée comme
 * en sortie : le compilateur signale immédiatement toute dérive entre le
 * serveur et ses clients.
 */

import type {
  AddIdentifiedPlantInput,
  AlertConfig,
  AuthTokens,
  BlogListResponse,
  BlogPost,
  BlogTag,
  CareLog,
  CareLogs,
  CreateCareLogInput,
  CreateGardenInput,
  CreatePlantInstanceInput,
  DashboardSummary,
  Garden,
  GardenPlan,
  GardenWeather,
  GardenWithStats,
  IdentifyApiResponse,
  MarkActionDoneInput,
  MobileLoginInput,
  MobileRegisterInput,
  PlantCatalog,
  PhotoKind,
  PlantInstanceWithRelations,
  RegisterPushTokenInput,
  TodayPlanning,
  UpdateAlertConfigInput,
  UpdateGardenInput,
  UpdatePlantInstanceInput,
  UpdateProfileInput,
  UploadedPhoto,
  UserProfile,
} from '@growi/shared'

import { HttpClient, type ApiClientOptions, type RequestOptions } from './http'

/**
 * Une photo prête à être envoyée.
 *
 * React Native n'a pas de `File` : il accepte, dans un `FormData`, un objet
 * décrivant le fichier local.
 */
export type UploadablePhoto = Blob | { uri: string; name: string; type: string }

/** Options communes à tous les appels : annulation, en-têtes ponctuels. */
export type CallOptions = Pick<RequestOptions, 'signal' | 'headers'>

export class GrowiApiClient {
  private readonly http: HttpClient

  constructor(options: ApiClientOptions) {
    this.http = new HttpClient(options)
  }

  get baseUrl(): string {
    return this.http.baseUrl
  }

  // ─── Authentification ────────────────────────────────────────────────────

  /**
   * Ces appels ne portent pas de jeton d'accès : ils en produisent.
   * Les utiliser depuis un client configuré avec `onUnauthorized` est sans
   * danger — un 401 de connexion n'est pas un jeton expiré — mais préférer un
   * client nu évite tout aller-retour inutile.
   */
  readonly auth = {
    register: (input: MobileRegisterInput, options?: CallOptions): Promise<AuthTokens> =>
      this.http.request('/api/v1/auth/register', {
        ...options,
        method: 'POST',
        body: input,
      }),

    login: (input: MobileLoginInput, options?: CallOptions): Promise<AuthTokens> =>
      this.http.request('/api/v1/auth/login', { ...options, method: 'POST', body: input }),

    /** Échange le jeton présenté contre un nouveau couple ; l'ancien est révoqué. */
    refresh: (refreshToken: string, options?: CallOptions): Promise<AuthTokens> =>
      this.http.request('/api/v1/auth/refresh', {
        ...options,
        method: 'POST',
        body: { refreshToken },
      }),

    /** Idempotent : révoquer un jeton inconnu ne provoque pas d'erreur. */
    logout: (refreshToken: string, options?: CallOptions): Promise<void> =>
      this.http.request('/api/v1/auth/logout', {
        ...options,
        method: 'POST',
        body: { refreshToken },
      }),
  }

  // ─── Jardins ─────────────────────────────────────────────────────────────

  readonly gardens = {
    list: (options?: CallOptions): Promise<GardenWithStats[]> =>
      this.http.request('/api/v1/gardens', { ...options }),

    get: (gardenId: string, options?: CallOptions): Promise<GardenWithStats> =>
      this.http.request(`/api/v1/gardens/${encodeURIComponent(gardenId)}`, { ...options }),

    create: (input: CreateGardenInput, options?: CallOptions): Promise<Garden> =>
      this.http.request('/api/v1/gardens', { ...options, method: 'POST', body: input }),

    update: (
      gardenId: string,
      input: UpdateGardenInput,
      options?: CallOptions,
    ): Promise<Garden> =>
      this.http.request(`/api/v1/gardens/${encodeURIComponent(gardenId)}`, {
        ...options,
        method: 'PATCH',
        body: input,
      }),

    remove: (gardenId: string, options?: CallOptions): Promise<void> =>
      this.http.request(`/api/v1/gardens/${encodeURIComponent(gardenId)}`, {
        ...options,
        method: 'DELETE',
      }),

    /**
     * Le plan dessiné, en SVG prêt à afficher.
     *
     * `ApiError.isNotFound` distingue mal ici « jardin inconnu » de « pas
     * encore de plan » : c'est voulu, l'app traite les deux pareil — il n'y a
     * rien à montrer.
     */
    plan: (gardenId: string, options?: CallOptions): Promise<GardenPlan> =>
      this.http.request(`/api/v1/gardens/${encodeURIComponent(gardenId)}/plan`, { ...options }),

    listPlants: (
      gardenId: string,
      options?: CallOptions,
    ): Promise<PlantInstanceWithRelations[]> =>
      this.http.request(`/api/v1/gardens/${encodeURIComponent(gardenId)}/plants`, {
        ...options,
      }),

    addPlant: (
      gardenId: string,
      input: CreatePlantInstanceInput,
      options?: CallOptions,
    ): Promise<PlantInstanceWithRelations> =>
      this.http.request(`/api/v1/gardens/${encodeURIComponent(gardenId)}/plants`, {
        ...options,
        method: 'POST',
        body: input,
      }),
  }

  // ─── Plantes ─────────────────────────────────────────────────────────────

  readonly plants = {
    /** Toutes les plantes, tous jardins confondus. */
    list: (options?: CallOptions): Promise<PlantInstanceWithRelations[]> =>
      this.http.request('/api/v1/plants', { ...options }),

    /** Ajoute une plante reconnue en photo, dans le jardin le plus récent. */
    addIdentified: (
      input: AddIdentifiedPlantInput,
      options?: CallOptions,
    ): Promise<PlantInstanceWithRelations> =>
      this.http.request('/api/v1/plants', { ...options, method: 'POST', body: input }),

    get: (plantId: string, options?: CallOptions): Promise<PlantInstanceWithRelations> =>
      this.http.request(`/api/v1/plants/${encodeURIComponent(plantId)}`, { ...options }),

    update: (
      plantId: string,
      input: UpdatePlantInstanceInput,
      options?: CallOptions,
    ): Promise<PlantInstanceWithRelations> =>
      this.http.request(`/api/v1/plants/${encodeURIComponent(plantId)}`, {
        ...options,
        method: 'PATCH',
        body: input,
      }),

    remove: (plantId: string, options?: CallOptions): Promise<void> =>
      this.http.request(`/api/v1/plants/${encodeURIComponent(plantId)}`, {
        ...options,
        method: 'DELETE',
      }),

    /** Historique d'entretien, groupé par type d'intervention. */
    listLogs: (plantId: string, options?: CallOptions): Promise<CareLogs> =>
      this.http.request(`/api/v1/plants/${encodeURIComponent(plantId)}/logs`, { ...options }),

    /** Enregistre un geste d'entretien, quel qu'il soit. */
    addLog: (
      plantId: string,
      input: CreateCareLogInput,
      options?: CallOptions,
    ): Promise<CareLog> =>
      this.http.request(`/api/v1/plants/${encodeURIComponent(plantId)}/logs`, {
        ...options,
        method: 'POST',
        body: input,
      }),
  }

  // ─── Catalogue d'espèces ─────────────────────────────────────────────────

  readonly catalog = {
    /**
     * Recherche par nom commun, nom scientifique ou alias.
     * Une requête vide renvoie les premières fiches par ordre alphabétique.
     */
    search: (
      query: string,
      options?: CallOptions & { category?: string },
    ): Promise<PlantCatalog[]> =>
      this.http.request('/api/v1/catalog', {
        ...options,
        query: { q: query, category: options?.category },
      }),
  }

  // ─── Planning ────────────────────────────────────────────────────────────

  readonly planning = {
    /** Tâches du jour, alertes et météo locale — l'écran d'accueil du mobile. */
    today: (options?: CallOptions): Promise<TodayPlanning> =>
      this.http.request('/api/v1/planning/today', { ...options }),

    /** Coche une tâche : le geste correspondant est noté sur la plante. */
    markDone: (input: MarkActionDoneInput, options?: CallOptions): Promise<void> =>
      this.http.request('/api/v1/planning/actions/done', {
        ...options,
        method: 'POST',
        body: input,
      }),
  }

  // ─── Photos ──────────────────────────────────────────────────────────────

  readonly uploads = {
    /**
     * Dépose une photo et renvoie son URL publique, à écrire ensuite dans le
     * `photoUrl` d'une plante ou d'un geste.
     *
     * `file` est un `Blob`/`File` côté web, ou l'objet `{ uri, name, type }`
     * que React Native attend dans un `FormData`.
     */
    photo: (
      file: UploadablePhoto,
      kind: PhotoKind = 'plant',
      options?: CallOptions,
    ): Promise<UploadedPhoto> => {
      const form = new FormData()
      form.append('file', file as unknown as Blob)
      form.append('kind', kind)

      return this.http.request('/api/v1/uploads', { ...options, method: 'POST', body: form })
    },
  }

  // ─── Indicateurs ─────────────────────────────────────────────────────────

  readonly weather = {
    /** Météo du jardin : prévision, contexte et conseils de la semaine. */
    get: (options?: CallOptions): Promise<GardenWeather> =>
      this.http.request('/api/v1/weather', { ...options }),
  }

  readonly summary = {
    /** Compteurs de l'accueil : jardins, plantes, gestes du jour, alertes. */
    get: (options?: CallOptions): Promise<DashboardSummary> =>
      this.http.request('/api/v1/summary', { ...options }),
  }

  // ─── Profil ──────────────────────────────────────────────────────────────

  readonly me = {
    get: (options?: CallOptions): Promise<UserProfile> =>
      this.http.request('/api/v1/me', { ...options }),

    update: (input: UpdateProfileInput, options?: CallOptions): Promise<UserProfile> =>
      this.http.request('/api/v1/me', { ...options, method: 'PATCH', body: input }),

    /** Enregistre l'appareil courant pour les notifications. */
    registerPushToken: (
      input: RegisterPushTokenInput,
      options?: CallOptions,
    ): Promise<void> =>
      this.http.request('/api/v1/me/push-tokens', {
        ...options,
        method: 'POST',
        body: input,
      }),

    /** Oublie l'appareil — à la déconnexion. Idempotent. */
    unregisterPushToken: (token: string, options?: CallOptions): Promise<void> =>
      this.http.request('/api/v1/me/push-tokens', {
        ...options,
        method: 'DELETE',
        body: { token },
      }),

    /** Préférences d'alertes — mise à jour partielle, fusionnée côté serveur. */
    updateAlerts: (
      input: UpdateAlertConfigInput,
      options?: CallOptions,
    ): Promise<AlertConfig> =>
      this.http.request('/api/v1/me/alerts', { ...options, method: 'PATCH', body: input }),
  }

  // ─── Blog ────────────────────────────────────────────────────────────────

  /**
   * Articles « Conseils & actus jardin ».
   *
   * Seuls appels **publics** de l'API : ils aboutissent sans jeton. Un client
   * nu suffit donc pour alimenter un écran visible avant connexion.
   */
  readonly blog = {
    /** Liste paginée, du plus récent au plus ancien. `limit` est plafonné à 50. */
    list: (
      params: { page?: number; limit?: number; tag?: BlogTag } = {},
      options?: CallOptions,
    ): Promise<BlogListResponse> =>
      this.http.request('/api/v1/blog', { ...options, query: params }),

    /** Article complet : le MDX y est déjà compilé en HTML, images absolues. */
    get: (slug: string, options?: CallOptions): Promise<BlogPost> =>
      this.http.request(`/api/v1/blog/${encodeURIComponent(slug)}`, { ...options }),
  }

  // ─── Identification photo ────────────────────────────────────────────────

  readonly identify = {
    /** @param imageBase64 data URL (`data:image/jpeg;base64,...`), 4 Mo maximum. */
    fromPhoto: (imageBase64: string, options?: CallOptions): Promise<IdentifyApiResponse> =>
      this.http.request('/api/v1/identify', {
        ...options,
        method: 'POST',
        body: { imageBase64 },
      }),
  }
}

/** Fabrique du client, à préférer au constructeur dans le code applicatif. */
export function createGrowiApiClient(options: ApiClientOptions): GrowiApiClient {
  return new GrowiApiClient(options)
}
