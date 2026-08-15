# Historique de migrations archivé

Ces fichiers **ne sont plus utilisés**. Ils sont conservés pour comprendre
comment la base a été construite avant la mise en place d'un historique de
migrations Prisma fiable (étape 3.0 du plan mobile, août 2026).

| Fichier | Nature |
|---|---|
| `20260413134838_init/` | Migration Prisma générée pour **SQLite** (prototype local, `prisma/dev.db`) |
| `20260415170000_add_plantcatalog_slug/` | Idem, SQLite |
| `supabase_init.sql` | Script de création du schéma réellement appliqué sur Supabase |
| `supabase_seed.sql` | Jeu de données initial |
| `manual_add_missing_user_fields.sql` | Colonnes ajoutées à la main, hors migration |
| `manual_add_recommendation_engine_fields.sql` | Idem |
| `manual_add_tree_type.sql` | Idem |

## Pourquoi cet archivage

Les deux migrations Prisma étaient en dialecte **SQLite** (`DATETIME`,
`TEXT NOT NULL PRIMARY KEY`) alors que la base de production est PostgreSQL :
`migration_lock.toml` déclarait `provider = "sqlite"`, ce qui faisait échouer
toute commande `prisma migrate` avec l'erreur P3019.

En parallèle, la table `_prisma_migrations` de Supabase était **vide** : le
schéma réel avait été monté depuis `supabase_init.sql` puis rapiécé à la main.
Prisma considérait donc qu'aucune migration n'était appliquée et aurait proposé
un `reset` — c'est-à-dire la perte des données.

## Ce qui les remplace

Une migration de référence `prisma/migrations/0_init/`, générée depuis le
schéma introspecté de la base réelle et déclarée appliquée via
`prisma migrate resolve --applied 0_init`. Elle n'a jamais été exécutée sur la
base : elle décrit l'état de départ, rien de plus.

À partir de là, `prisma migrate dev` fonctionne normalement et ne génère que
les changements réels.
