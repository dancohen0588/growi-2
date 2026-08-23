/**
 * Le vrai paquet `server-only` lève à l'import hors d'un environnement React
 * Server. Vitest n'en est pas un : on l'alias vers ce module vide
 * (`vitest.config.ts`) pour pouvoir tester les couches marquées server-only.
 */
export {}
