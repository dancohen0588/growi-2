/**
 * Client typé de l'API Growi v1.
 *
 * Une méthode par endpoint, avec les types de `@growi/shared` en entrée comme
 * en sortie : le compilateur signale immédiatement toute dérive entre le
 * serveur et ses clients.
 */

import type {
  CareLogs,
  CreateCareLogInput,
  CreateGardenInput,
  CreatedCareLog,
  CreatePlantInstanceInput,
  Garden,
  GardenWithStats,
  IdentifyApiResponse,
  PlantInstanceWithRelations,
  TodayPlanning,
  UpdateGardenInput,
  UpdatePlantInstanceInput,
  UpdateProfileInput,
  UserProfile,
} from '@growi/shared'

import { HttpClient, type ApiClientOptions, type RequestOptions } from './http'

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

    /** Enregistre un arrosage, une taille, une fertilisation ou une note de santé. */
    addLog: (
      plantId: string,
      input: CreateCareLogInput,
      options?: CallOptions,
    ): Promise<CreatedCareLog> =>
      this.http.request(`/api/v1/plants/${encodeURIComponent(plantId)}/logs`, {
        ...options,
        method: 'POST',
        body: input,
      }),
  }

  // ─── Planning ────────────────────────────────────────────────────────────

  readonly planning = {
    /** Tâches du jour, alertes et météo locale — l'écran d'accueil du mobile. */
    today: (options?: CallOptions): Promise<TodayPlanning> =>
      this.http.request('/api/v1/planning/today', { ...options }),
  }

  // ─── Profil ──────────────────────────────────────────────────────────────

  readonly me = {
    get: (options?: CallOptions): Promise<UserProfile> =>
      this.http.request('/api/v1/me', { ...options }),

    update: (input: UpdateProfileInput, options?: CallOptions): Promise<UserProfile> =>
      this.http.request('/api/v1/me', { ...options, method: 'PATCH', body: input }),
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
