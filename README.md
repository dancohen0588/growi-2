# Growi

Application de gestion de jardins (B2C + B2B) — monorepo pnpm + Turborepo.

## Structure

| Chemin | Contenu |
|---|---|
| `apps/web` | Application Next.js 14 (marketing, auth, dashboard) — anciennement `growi-frontend` |
| `packages/shared` | `@growi/shared` : types TypeScript, schémas Zod et constantes métier partagés |
| `docs` | Specs, plans d'implémentation, prototypes |

## Prérequis

- Node.js ≥ 20
- pnpm (`npm install -g pnpm`)

## Démarrage

```bash
pnpm install
pnpm --filter web dev
```

Le site tourne sur http://localhost:3000. Les variables d'environnement du web sont
dans `apps/web/.env.local` (voir `apps/web/.env.example`).

## Commandes utiles

```bash
pnpm --filter web build     # Build de production
pnpm --filter web lint      # ESLint
pnpm --filter web test      # Tests unitaires (Vitest)
pnpm --filter web e2e       # Tests end-to-end (Playwright)
pnpm build                  # Build de tous les packages (Turborepo)
pnpm typecheck              # Vérification des types sur tout le monorepo
```

## Observabilité

Sentry couvre les erreurs et les traces du web et de l'API (projet `growi-web`,
région UE). PostHog viendra ensuite pour l'analyse produit. Spec :
`~/Growi/Documentation/spec/09-spec-observabilite.md`.

| Fichier | Rôle |
|---|---|
| `apps/web/lib/observability/sentry-options.ts` | Réglages communs aux trois runtimes, et `scrubEvent` — la barrière aux données personnelles |
| `apps/web/sentry.{client,server,edge}.config.ts` | Un `Sentry.init` par runtime ; seul le serveur ajoute `prismaIntegration` |
| `apps/web/instrumentation.ts` | Charge la bonne configuration au démarrage |
| `apps/web/lib/observability/report.ts` | Ce qu'on remonte, et sous quel nom de route |

**En local, rien ne part** : sans `NEXT_PUBLIC_SENTRY_DSN` on n'initialise pas,
et hors Vercel `enabled` reste faux même si un DSN traîne dans `.env.local`.
C'est délibéré — un `console.error` de développement n'a pas à consommer le
quota du plan gratuit (5 000 erreurs par mois).

**Ce qui n'est volontairement pas remonté** : les `ServiceError` dont le code
est `UNAUTHENTICATED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_INPUT`, `CONFLICT`,
`RATE_LIMITED` ou `QUOTA_EXCEEDED`, ainsi que les erreurs de validation Zod. Ce
sont des réponses, pas des pannes : les capturer noierait les vraies en
quelques heures. Restent `INTERNAL` et `UNAVAILABLE`, taguées `service_code` et
`route`.

**Aucune donnée personnelle** : `sendDefaultPii: false`, `Sentry.setUser` ne
pose que l'identifiant interne, et `scrubEvent` retire cookie, `Authorization`,
photo (`imageBase64` → `[image]`) et toute clé nommée e-mail, mot de passe ou
jeton, à toute profondeur.

**Vérifier la chaîne** (déploiement preview, `DEBUG_TOKEN` posé dans Vercel) :

```bash
curl -H "x-debug-token: $DEBUG_TOKEN" https://<deploiement>.vercel.app/api/v1/_debug/sentry
```

L'issue doit apparaître dans `growi-web` avec `environment: preview` et le SHA
du commit en release. Cette route et son jeton disparaîtront à la fin de la
Friends & Family.

Les instrumentations manuelles à connaître : `gemini.generate` (une par
tentative de modèle, avec jetons, repli et troncature), `weather.fetch`
(Open-Meteo) et `push.send` (tournée du matin).
