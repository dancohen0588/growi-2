/**
 * Point d'entrée d'instrumentation de Next : appelé une fois au démarrage de
 * chaque runtime, avant tout code applicatif.
 *
 * En Next 14, il ne s'exécute que si `experimental.instrumentationHook` est
 * vrai dans `next.config.mjs` — le retirer désactiverait silencieusement
 * Sentry côté serveur, sans aucune erreur.
 *
 * L'import est dynamique et conditionnel : charger la configuration Node dans
 * le runtime Edge y ferait entrer des modules qu'il ne sait pas exécuter.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// `onRequestError`, qui capture les erreurs de rendu serveur non interceptées,
// demande Next 15 : rien à exporter ici tant qu'on est en 14. Nos routes API
// passent de toute façon par `withApiErrorHandling`, qui les remonte.
