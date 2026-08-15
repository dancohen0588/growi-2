/**
 * @growi/api-client — client TypeScript de l'API Growi v1.
 *
 * ```ts
 * const api = createGrowiApiClient({
 *   baseUrl: process.env.EXPO_PUBLIC_API_URL!,
 *   getAccessToken: () => SecureStore.getItemAsync('accessToken'),
 *   onUnauthorized: refreshSession, // true => la requête est rejouée
 * })
 *
 * const gardens = await api.gardens.list()
 * ```
 */

export { GrowiApiClient, createGrowiApiClient, type CallOptions } from './client'
export { ApiError, isApiError, CLIENT_ERROR_CODES } from './errors'
export { HttpClient, type ApiClientOptions, type RequestOptions } from './http'
