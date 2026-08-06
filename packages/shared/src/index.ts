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
export * from './schemas/common'
export * from './schemas/user'
export * from './schemas/garden'
export * from './schemas/plant'
export * from './schemas/logs'
