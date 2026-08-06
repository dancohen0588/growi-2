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
