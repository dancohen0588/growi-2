# Growi — Section Blog (site + app) en MDX dans le repo

> Note de cadrage à donner à Claude Code, pointé sur `/Users/dancohen/Growi/growi-2`.
> Rédigée le 22 août 2026, mise à jour le 23 août 2026 : **option CMS abandonnée** (Strapi Cloud a
> supprimé son plan gratuit, Ghost(Pro) est payant, pas de self-host possible pour l'instant).
> Le contenu vit désormais **en fichiers MDX dans le repo** — gratuit, versionné, rédigé via Claude Code.
> Les chemins et conventions ci-dessous ont été vérifiés dans le repo.

---

## 1. Objectif

Ajouter un blog « Conseils & actus jardin » dont les articles sont des **fichiers MDX committés dans
`apps/web`**, affiché :

- sur le **site web** (`apps/web`) : liste d'articles + page article, SEO complet ;
- dans l'**app mobile** (`apps/mobile`) : carrousel « Conseils » sur l'écran Accueil + écrans liste et
  détail dans la pile `accueil`.

Une seule source de contenu (les fichiers MDX), consommée par les deux supports : le web les lit
directement au build, le mobile passe par l'**API v1 de `apps/web`** qui sert le contenu compilé en
HTML, via `@growi/api-client`.

Publier un article = ajouter un fichier `.mdx` + commit + push (déploiement Vercel automatique).
Aucun service externe, aucune clé API, aucun coût. Si un vrai CMS devient nécessaire un jour
(auteurs non-développeurs), seul le module `lib/blog/` changera : le contrat de données, l'API v1,
l'api-client et le mobile resteront identiques.

## 2. État actuel du repo (vérifié)

| Élément | État |
|---|---|
| `apps/web/app/(marketing)/blog/page.tsx` | Page placeholder « Bientôt disponible » (blobs décoratifs + lien retour) — **à remplacer** |
| `components/layout/Header.tsx` | Lien `/blog` déjà présent dans la nav (ligne 16–21) — rien à faire |
| `apps/web/app/sitemap.ts` | `/blog` déjà listé en statique ; ajouter les routes dynamiques `/blog/[slug]` sur le modèle des routes `encyclopedie/${slug}` |
| `apps/web/app/api/v1/*` | Routes REST existantes (gardens, plants, planning, me, identify, catalog, weather, summary…) — ajouter `blog/` |
| `packages/api-client/src/client.ts` | Une méthode par endpoint, typée avec `@growi/shared` — ajouter `blog` |
| `packages/shared/schemas/` | Schémas Zod d'entité (JSON API, dates ISO) — ajouter `blog.ts` |
| `apps/mobile/app/(tabs)/_layout.tsx` | 5 onglets (Accueil, Mon jardin, Mes plantes, Calendrier, Identifier) — **ne pas ajouter d'onglet** |
| `apps/mobile/app/(tabs)/accueil/index.tsx` | Écran d'accueil avec `StatCard`, `GardenContextCard`, CTA Identifier — insérer la section Conseils ici |
| Mobile deps | `@tanstack/react-query`, `zustand`, `expo-web-browser` déjà présents |

Design mobile : **le skill `.claude/skills/growi-mobile-design` fait foi** pour tout nouvel écran ou composant.

## 3. Choix technique : MDX dans le repo

- Articles dans **`apps/web/content/blog/*.mdx`**, un fichier par article, nommé par son slug
  (`preparer-son-potager-en-septembre.mdx`).
- Images de couverture et illustrations dans **`apps/web/public/blog/<slug>/`**, référencées en
  chemins absolus (`/blog/<slug>/cover.jpg`) — servies par Vercel, optimisées par `next/image`.
- Frontmatter YAML obligatoire (validé par Zod au build, erreur explicite si un champ manque) :

```yaml
---
title: "Préparer son potager en septembre"
excerpt: "Semis d'automne, engrais verts, derniers arrosages : la check-list du mois."
coverImage: "/blog/preparer-son-potager-en-septembre/cover.jpg"
coverImageAlt: "Potager en fin d'été"
publishedAt: "2026-09-01"
updatedAt: "2026-09-01"        # facultatif, = publishedAt par défaut
tags: [potager, saison]        # parmi : saison, potager, entretien, maladies, actus-growi
author: "Dan"                  # facultatif, "Growi" par défaut
draft: false                   # true = invisible en prod, visible en dev
---
```

- Stack de compilation : **`next-mdx-remote` + `gray-matter`** (lecture des fichiers via `fs` dans
  les Server Components), plugins `remark-gfm` (tableaux, listes de tâches) et `rehype-slug` +
  `rehype-autolink-headings` (ancres). À déclarer dans le `package.json` de `web` (pnpm strict).
  Pas de `@next/mdx` : on ne veut pas des articles comme routes compilées, mais comme données
  lues par `lib/blog/`, pour pouvoir les servir aussi en JSON à l'API v1.
- Temps de lecture calculé au build (`Math.ceil(mots / 200)`).
- Composants MDX autorisés dans les articles (mappés dans le renderer) : `<Callout>` (encadré
  conseil), `<YouTube id="..." />`, images Markdown standard. En rester là en V1.
- Tri par `publishedAt` décroissant ; les `draft: true` sont exclus quand `NODE_ENV === 'production'`.

**Pourquoi pas un CMS ?** Strapi Cloud a supprimé son plan gratuit, Ghost(Pro) est payant et le
self-host n'est pas possible pour l'instant. Dan est seul auteur et rédige via Claude Code : le repo
*est* l'éditeur. Alternatives gratuites notées pour plus tard si besoin d'un éditeur web : Sanity
(free tier 10k documents), Prismic (1 utilisateur), Hashnode headless.

## 4. Architecture cible

```
apps/web/content/blog/*.mdx  +  public/blog/<slug>/…
        │
        ▼
apps/web/lib/blog/content.ts      ← seul module qui lit les fichiers (server-only)
        │                  │
        ▼                  ▼
app/(marketing)/blog/*    app/api/v1/blog/*     ← JSON { data } / { error }, schémas @growi/shared
  (Server Components,            │                 (HTML compilé côté serveur pour le mobile)
   statique, SEO)                ▼
                     packages/api-client  api.blog.list() / api.blog.get(slug)
                                 │
                                 ▼
                     apps/mobile (react-query, carte Accueil + écrans liste/détail)
```

Tout est statique côté web (les articles sont dans le bundle au build) : pas de revalidation,
pas de webhook — un push suffit.

## 5. Contrat de données (`packages/shared/schemas/blog.ts`)

```ts
import { z } from 'zod'
import { isoDateTimeSchema } from './common'

export const blogTagSchema = z.enum(['saison', 'potager', 'entretien', 'maladies', 'actus-growi'])

// Vue liste : pas de HTML, léger pour le mobile
export const blogPostSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  coverImage: z.string().nullable(),     // chemin absolu (/blog/…), l'API v1 le préfixe en URL complète
  coverImageAlt: z.string().nullable(),
  publishedAt: isoDateTimeSchema,
  readingTime: z.number().int(),         // minutes
  tags: z.array(blogTagSchema),
  author: z.string(),
})

// Vue détail : + contenu HTML compilé depuis le MDX
export const blogPostSchema = blogPostSummarySchema.extend({
  html: z.string(),
  updatedAt: isoDateTimeSchema,
})

export const blogListResponseSchema = z.object({
  posts: z.array(blogPostSummarySchema),
  pagination: z.object({ page: z.number(), pages: z.number(), total: z.number(), next: z.number().nullable() }),
})

export type BlogTag = z.infer<typeof blogTagSchema>
export type BlogPostSummary = z.infer<typeof blogPostSummarySchema>
export type BlogPost = z.infer<typeof blogPostSchema>
```

Exporter depuis `packages/shared/index.ts`. Tests Vitest : frontmatter fixture → schéma
(`pnpm --filter @growi/shared test`).

Note : côté web, les pages rendent le MDX avec `next-mdx-remote` (composants React). Le champ
`html` du schéma n'est utilisé que par l'API v1 pour le mobile : `lib/blog/content.ts` compile
alors le MDX en HTML pur (les composants custom `<Callout>`/`<YouTube>` sont rendus en HTML
équivalent simple).

## 6. Plan de développement (phases, une par session Claude Code)

### Phase 1 — Contenu et couche de lecture (`apps/web`)
- Créer `content/blog/` avec **3 articles réels de lancement** (rédigés pendant la session, ton
  Growi : tutoiement, concret, saisonnier — septembre 2026) + leurs images dans `public/blog/`
  (placeholders générés ou images libres en attendant les vraies).
- `lib/blog/content.ts` (`import 'server-only'`) :
  - `listPosts({ page = 1, limit = 12, tag? })` → `BlogListResponse`
  - `getPost(slug)` → source MDX + méta (pour les pages web)
  - `getPostAsHtml(slug)` → `BlogPost | null` (pour l'API v1 : MDX compilé en HTML)
  - `listSlugs()` pour `generateStaticParams` et le sitemap
  - Lecture `fs.readdirSync` + `gray-matter`, validation Zod du frontmatter avec message d'erreur
    citant le fichier fautif, cache module-level (`Map`) pour ne parser qu'une fois par process.
- Schémas `@growi/shared/schemas/blog.ts` + tests (section 5).
- Ajouter `next-mdx-remote`, `gray-matter`, `remark-gfm`, `rehype-slug`, `rehype-autolink-headings`
  au `package.json` de `web`.

### Phase 2 — Pages web
- `app/(marketing)/blog/page.tsx` : remplace le placeholder. Grille de cartes (image, tag principal,
  titre, extrait, date + temps de lecture), filtre par tag via `?tag=`, pagination `?page=`.
  Réutiliser les tokens existants (`bg-sand`, `text-forest`, `font-poppins`, `font-raleway`,
  `shadow-cta`). Conserver le layout `(marketing)` (Header/Footer déjà fournis). État vide élégant
  si aucun article.
- `app/(marketing)/blog/[slug]/page.tsx` : `generateMetadata` (title/excerpt, OpenGraph image =
  coverImage, `alternates.canonical`), JSON-LD `Article`, `notFound()` si slug inconnu ou draft en
  prod, rendu MDX via `next-mdx-remote/rsc` avec les composants custom (`Callout`, `YouTube`) dans
  un conteneur typographique (`@tailwindcss/typography` si absent → sinon styles `prose` maison),
  bloc « Articles liés » (même tag, 3 max), CTA bas de page vers l'app (réutiliser
  `fonctionnalites/components/CTABottom.tsx`).
- Pages 100 % statiques : `generateStaticParams` + `export const dynamic = 'force-static'` (la
  liste avec `?tag=`/`?page=` peut rester dynamique ou gérer le filtre côté client — au choix du
  plus simple).
- `app/sitemap.ts` : ajouter les routes `/blog/${slug}` avec `lastModified = updatedAt`.
- Composants partagés dans `app/(marketing)/blog/components/` (`PostCard`, `TagPills`, `PostMeta`).
- Images via `next/image` (fichiers locaux : pas de `remotePatterns` à configurer).

### Phase 3 — API v1 pour le mobile (`apps/web/app/api/v1/blog`)
- `GET /api/v1/blog?page=&limit=&tag=` → `{ data: BlogListResponse }`
- `GET /api/v1/blog/[slug]` → `{ data: BlogPost }` (HTML compilé) ou `{ error }` 404
- Public (pas d'auth) : suivre la convention des autres routes v1 pour les enveloppes
  `{ data } / { error }` de `schemas/common.ts`, mais sans le middleware JWT.
- Préfixer `coverImage` et les `src` d'images du HTML par l'URL absolue du site
  (`NEXT_PUBLIC_SITE_URL`) pour que le mobile puisse les charger.
- Headers `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` (le contenu ne
  change qu'au deploy).
- Tests : un test Vitest par route sur des fixtures MDX de test.

### Phase 4 — `@growi/api-client`
- Ajouter `blog: { list(params?), get(slug) }` dans `client.ts`, typé avec les schémas shared,
  erreurs en `ApiError` comme les autres.
- Mettre à jour `packages/api-client/README.md` et les tests (`pnpm --filter @growi/api-client test`)
  avec `fetch` injecté.

### Phase 5 — Mobile (`apps/mobile`) — lire le skill `growi-mobile-design` d'abord
Placement décidé : **pas de nouvel onglet**. Le blog vit dans la pile `accueil`.

- Routes Expo Router :
  - `app/(tabs)/accueil/conseils/index.tsx` — liste (FlatList, pull-to-refresh, pagination infinie
    via `useInfiniteQuery`, filtre tags en chips horizontales)
  - `app/(tabs)/accueil/conseils/[slug].tsx` — détail
  - Déclarer les écrans dans `app/(tabs)/accueil/_layout.tsx` (Stack) avec titres « Conseils » /
    titre de l'article.
- Accueil (`accueil/index.tsx`) : nouvelle section **« Conseils du moment »** sous la
  `GardenContextCard` : titre + lien « Tout voir » → `/(tabs)/accueil/conseils`, carrousel
  horizontal de 5 `PostCard` (image 16:9, tag, titre 2 lignes, temps de lecture). Skeleton pendant
  le chargement, section masquée (pas d'erreur visible) si l'API échoue.
- Composants : `components/blog/PostCard.tsx`, `components/blog/PostCardSkeleton.tsx`,
  `components/blog/TagChips.tsx`.
- Hooks : `hooks/useBlogPosts.ts` (`useInfiniteQuery(['blog', tag])`), `hooks/useBlogPost.ts`
  (`useQuery(['blog', slug])`), `staleTime: 60 min` (contenu quasi statique).
- Rendu HTML du détail : ajouter `react-native-render-html` (déclarer dans
  `apps/mobile/package.json`) avec styles mappés sur les tokens (Poppins pour h2/h3, Raleway pour
  le corps, couleur `forest`), images responsive, liens ouverts avec `expo-web-browser`
  (`openBrowserAsync`). Alternative plus légère si le rendu pose problème : `WebView` avec le HTML
  et une feuille de style injectée.
- Bouton « Partager » dans l'en-tête du détail → `Share.share({ url: \`${SITE_URL}/blog/${slug}\` })`
  (partage l'URL web, bon pour le SEO).
- Deep link : `growi://blog/[slug]` → route détail (utile pour de futures notifs push
  « Nouvel article »).
- Respecter : safe areas, zones tactiles ≥ 44 pt, états vide/erreur/chargement, `typecheck` mobile vert.

### Phase 6 — Qualité & livraison
- `pnpm typecheck`, `pnpm lint`, `pnpm test` à la racine (Turborepo).
- Playwright e2e web : `/blog` affiche ≥ 1 carte, clic → page article avec `h1` et JSON-LD ;
  `/blog/slug-inexistant` → 404 ; un article `draft: true` n'apparaît pas en build de prod.
- Vérifier Lighthouse SEO/perf sur une page article.
- Mettre à jour `CLAUDE.md` (section Codebase actuelle) : dossier `content/blog`, module
  `lib/blog`, routes `/api/v1/blog`, workflow de publication, emplacement mobile.
- Documenter le workflow de publication dans `content/blog/README.md` (template de frontmatter,
  noms de fichiers, dossier images, tags autorisés, `draft`).

## 7. Prompts prêts à coller dans Claude Code

**Session 1 (phases 1–2)**
```
Lis CLAUDE.md puis docs/blog/04-blog-mdx-plan-claude-code.md. Implémente les phases 1 et 2 :
les schémas @growi/shared/schemas/blog.ts avec leurs tests, la couche lib/blog/content.ts
(server-only : gray-matter + next-mdx-remote, validation Zod du frontmatter, listPosts/getPost/
getPostAsHtml/listSlugs, cache module-level), 3 vrais articles de lancement dans content/blog/
(ton Growi : tutoiement, concret, calé sur septembre 2026) avec images dans public/blog/, puis
remplace le placeholder app/(marketing)/blog/page.tsx par la liste paginée/filtrée et crée
app/(marketing)/blog/[slug]/page.tsx avec generateMetadata, JSON-LD Article, generateStaticParams,
composants MDX Callout/YouTube, et l'ajout au sitemap. Réutilise les tokens et composants
marketing existants. Crée aussi content/blog/README.md (workflow de publication). Termine par
pnpm --filter web typecheck && lint.
```

**Session 2 (phases 3–4)**
```
Lis CLAUDE.md puis docs/blog/04-blog-mdx-plan-claude-code.md. Implémente les phases 3 et 4 :
routes publiques GET /api/v1/blog et /api/v1/blog/[slug] (enveloppes { data }/{ error } de
schemas/common.ts, HTML compilé, URLs d'images absolues via NEXT_PUBLIC_SITE_URL, cache headers),
leurs tests Vitest sur des fixtures MDX, puis la méthode `blog` dans @growi/api-client avec tests
et README. Vérifie avec pnpm test à la racine.
```

**Session 3 (phase 5)**
```
Lis CLAUDE.md, le skill .claude/skills/growi-mobile-design et
docs/blog/04-blog-mdx-plan-claude-code.md. Implémente la phase 5 dans apps/mobile : section
« Conseils du moment » sur l'accueil (carrousel horizontal, skeleton, masquée en cas d'erreur),
écrans accueil/conseils/index.tsx et accueil/conseils/[slug].tsx déclarés dans le Stack de
l'accueil, hooks react-query via api.blog, rendu HTML avec react-native-render-html stylé sur les
tokens, partage de l'URL web, deep link growi://blog/[slug]. pnpm --filter mobile typecheck doit
passer.
```

**Session 4 (phase 6)** : tests e2e, Lighthouse, mise à jour de CLAUDE.md.

**Prompt de rédaction d'un nouvel article (à réutiliser à chaque publication)**
```
Lis content/blog/README.md et deux articles existants dans content/blog/ pour le ton et le format.
Rédige un article « <sujet> » : frontmatter complet (slug en kebab-case, excerpt ≤ 160 caractères
pour le SEO, tags parmi la liste autorisée, publishedAt = aujourd'hui), 800–1200 mots, tutoiement,
conseils actionnables calés sur la saison, un Callout, des intertitres h2. Mets draft: true, je le
passerai à false après relecture. Signale-moi les images à fournir dans public/blog/<slug>/.
```

## 8. Points ouverts à trancher par Dan

1. Faut-il une page par tag (`/blog/tag/[tag]`) en plus du filtre `?tag=` ? (Mieux pour le SEO,
   V1.1 sinon.)
2. Newsletter : hors périmètre V1. Si besoin plus tard → formulaire + Resend (déjà configuré pour
   le contact) ou un service dédié.
3. Langue unique (français) pour l'instant ; prévoir un tag `en` si un jour bilingue.
4. Migration future vers un CMS (Sanity/Prismic ont un free tier, Hashnode headless est gratuit) :
   uniquement si un auteur non-développeur arrive — seul `lib/blog/content.ts` serait à réécrire.
