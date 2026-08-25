/**
 * @growi/shared — types, schémas Zod et constantes métier partagés
 * entre l'app web (apps/web) et l'app mobile (apps/mobile).
 *
 * Deux familles de schémas :
 * - les **entités** (`gardenSchema`, `plantInstanceSchema`, …) décrivent la
 *   représentation JSON renvoyée par l'API v1 — dates en chaînes ISO ;
 * - les **DTOs** (`createGardenSchema`, `updateProfileSchema`, …) valident les
 *   corps de requête et les formulaires, côté serveur comme côté client.
 */

export * from './constants/enums'
export * from './constants/weather'
export * from './schemas/common'
export * from './schemas/user'
export * from './schemas/garden'
export * from './schemas/plant'
export * from './schemas/logs'
export * from './schemas/planning'
export * from './schemas/summary'
export * from './schemas/weather'
export * from './schemas/upload'
export * from './schemas/push'
export * from './schemas/identify'
export * from './schemas/diagnosis'
export * from './schemas/auth'
export * from './schemas/blog'
