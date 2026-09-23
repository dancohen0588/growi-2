# Le blog Growi — comment il fonctionne

Les articles « Conseils & actus jardin » vivent **en base** (table
`blog_posts`), leurs couvertures dans le bucket Supabase **`blog-covers`**.
Il n'y a plus de fichier `.mdx` dans le dépôt : publier ne demande ni commit ni
déploiement. Un article publié apparaît aussitôt sur `/blog` ; l'app mobile le
voit dans l'heure, le temps que le cache CDN de l'API v1 expire.

Spec de référence : `~/Growi/Documentation/spec/spec-generation-conseils.md`.

> Ce dossier ne contient plus que cette documentation. Les trois premiers
> articles y ont été importés en base le 23/09/2026 ; le script d'import a été
> retiré avec eux (il reste dans l'historique, commit `c446e24`).

## Cycle de vie d'un article

```
DRAFT ──publier──▶ PUBLISHED ──dépublier──▶ ARCHIVED
  ▲                                            │
  └──────────────── (republier) ◀──────────────┘
```

| Statut | Visible sur le site et l'API | Remarque |
|---|---|---|
| `DRAFT` | non | Relu et corrigé dans l'admin. Au plus **2** en attente : au-delà, la génération automatique s'arrête. |
| `PUBLISHED` | oui | Le **slug est figé** à la première publication : le changer casserait les liens partagés et le référencement. |
| `ARCHIVED` | non (404) | Dépublié, mais relisible et republiable. |

Seul `lib/blog/content.ts` lit les articles pour le public, et il ne sert que
`PUBLISHED` — en développement comme en production. L'aperçu d'un brouillon se
fait dans l'admin.

## D'où viennent les articles

| Origine (`origin`) | Comment |
|---|---|
| `cron` | Génération automatique, chaque lundi 7 h UTC si la cadence réglée dans l'admin le prévoit |
| `admin` | Bouton « Générer un article » de `/admin/conseils`, avec un sujet facultatif *(phase 4)* |
| `manual` | Écrit à la main, avec le skill Claude Code `growi-blog-article` *(phase 5)*. Les trois premiers articles, importés, portent aussi cette origine. |

Quelle que soit l'origine, **un humain relit avant publication**. Un article
généré arrive avec des « notes pour le relecteur » : chaque chiffre, date,
dose ou affirmation botanique à vérifier. Elles ne sont jamais publiées.

L'auteur affiché est toujours **« Growi »**.

## Le format d'un article

| Champ | Contrainte |
|---|---|
| `title` | Sert de `h1` et de balise `title`. Vise 50–60 caractères. |
| `slug` | kebab-case sans accent (`preparer-son-potager-en-septembre`). |
| `excerpt` | Méta-description et résumé de carte, **≤ 160 caractères**. |
| `tags` | Parmi `saison` · `potager` · `entretien` · `maladies` · `actus-growi`. Le premier sert d'étiquette sur la carte. `actus-growi` est réservé aux annonces produit, écrites à la main. |
| `source` | Le corps, en MDX (voir ci-dessous). |
| `coverImage` / `coverImageAlt` | URL `blog-covers` et description de ce qu'on **voit**. Sans couverture, la carte affiche un dégradé. |

La liste des tags fait foi dans
[`packages/shared/src/schemas/blog.ts`](../../../../packages/shared/src/schemas/blog.ts) :
en ajouter un demande de lui donner un libellé d'affichage là-bas.

### Le corps

Du Markdown standard, plus les tableaux et listes de tâches (`remark-gfm`).
Chaque `##` reçoit une ancre. **Pas d'image dans le corps** en v1, ni de HTML
brut, ni de lien externe hors `<YouTube>`.

Deux composants :

```mdx
<Callout title="Le calcul à faire avant chaque semis">
Texte du conseil. Le `tone` par défaut est « conseil » (vert).
</Callout>

<Callout tone="attention" title="Le mildiou ne se rattrape pas">
Pour les mises en garde (jaune).
</Callout>

<YouTube id="dQw4w9WgXcQ" title="Tailler un rosier en 3 minutes" />
```

C'est volontairement tout : un composant de plus est un composant à
maintenir aussi dans le HTML servi au mobile (`htmlMdxComponents`).

### Le ton Growi

- **Tutoiement**, toujours.
- **Concret** : des seuils, des durées, des quantités. « Arroser régulièrement »
  ne veut rien dire ; « tous les quatre jours, au pied, le matin » si.
- **Saisonnier** : un article se lit au moment où on en a besoin — un sujet
  d'octobre sort mi-septembre.
- Growi se mentionne au plus deux fois, quand l'appli résout vraiment le
  problème du paragraphe.
- 800 à 1200 mots, un `##` tous les 200–300 mots, au moins un `<Callout>`.
- **Jamais le mot « IA »**, ni aucune mention de la façon dont le texte a été
  produit. Ni personnes, ni marques, ni prix.

Ces règles sont des constantes de prompt et des contrôles dans
[`lib/blog/editorial.ts`](../../lib/blog/editorial.ts), qui **fait foi** : en
cas d'écart avec cette page, c'est le code qui a raison.

## Générer un article

Le service `lib/services/blog-generator.service.ts` enchaîne :

1. **Thème** — le modèle reçoit la date, les thèmes de saison des 3 à 5
   semaines à venir (`SEASONAL_CALENDAR`), l'inventaire de tous les articles et
   les tags du moins au plus fourni. Il propose trois sujets ; on retient le
   premier qui ne ressemble à aucun titre existant. Un sujet imposé depuis
   l'admin saute cette étape.
2. **Rédaction** — un JSON conforme à `generatedArticleSchema`.
3. **Contrôles**, tous bloquants : slug libre, titre qui ne double rien,
   compilation *et rendu* du MDX, puis le lint d'`editorial.ts` (mots,
   intertitres, encadré, tutoiement, termes interdits, HTML, liens, images).
   Un échec donne lieu à **une** réécriture, à laquelle on passe la liste des
   défauts ; au second échec, on abandonne (Sentry).
4. **Brouillon** — `DRAFT`, couverture `PENDING`, notes pour le relecteur,
   raison du thème, et une trace (`generation` : modèles, durées, tentatives,
   jetons, défauts des versions refusées).

L'extrait et le texte alternatif sont des limites **souples** : un dépassement
de quelques caractères est coupé au dernier mot, et une note prévient le
relecteur. Au-delà de deux brouillons en attente, rien n'est généré.

Pour essayer les prompts avec la vraie clé Gemini (écrit un brouillon dans la
base de `.env`, visible seulement dans l'admin) :

```bash
pnpm --filter web blog:generate
pnpm --filter web blog:generate --topic "Pailler ses massifs avant l'hiver"
```

Les défauts de la dernière version refusée s'affichent en cas d'échec : c'est
ce qui sert à régler `editorial.ts`.

## Les couvertures

Format unique, quelle que soit l'origine : **16:9, 1600 px de large au plus,
JPEG qualité 82**, sous 600 Ko. C'est `toCoverJpeg` (`lib/blog/cover-image.ts`)
qui l'applique — recadrage centré, jamais d'agrandissement.

Le bucket `blog-covers` est public en lecture, JPEG uniquement, 2 Mo au plus ;
seule la clé service y écrit. Il a été créé par migration Supabase
(`storage.buckets`), pas par Prisma. Chaque dépôt prend un chemin neuf
(`<slug>/cover-<horodatage>.jpg`) : l'ancienne image n'est supprimée qu'une
fois la nouvelle enregistrée.

Une photo réelle est toujours préférable. À défaut, la couverture est générée
(`lib/services/blog-cover.service.ts`, modèle `gemini-2.5-flash-image`, 16:9)
avec une recette fixe, pour que les images forment une série :

1. **Un sujet concret et daté**, tiré de l'article — pas une image d'ambiance.
2. **Un cadre français** : murets de pierre, bâti ancien, terrasse en pierre.
3. **La lumière** : naturelle et rasante, matin ou fin d'après-midi.
4. **Le rendu** : `Natural documentary photography, shallow depth of field`,
   palette verte et ocre.
5. **Les interdits**, toujours : `No people, no text, no logos, no watermark.`

Le prompt est conservé sur l'article (`coverPrompt`) pour pouvoir régénérer.
**L'image ne bloque jamais l'article** : le texte est enregistré dès qu'il est
validé, l'image n'est tentée que s'il reste 20 s, et un échec laisse la
couverture `PENDING` — l'image existante (dégradé, ou précédente) reste en
place. Chaque passage du cron rattrape la plus ancienne couverture en attente.

> ⚠️ **Facturation Gemini requise.** L'offre gratuite a un quota **nul** pour
> `gemini-2.5-flash-image` : sans facturation activée sur le projet Google de
> `GEMINI_API_KEY`, toutes les couvertures restent `PENDING`. Le texte, lui,
> passe sur l'offre gratuite.

Pour produire ou refaire une couverture à la main :

```bash
pnpm --filter web blog:generate --cover <slug>
```

## Planification

`GET /api/cron/blog-generate`, déclenchée **chaque lundi à 7 h UTC**
(`vercel.json`), protégée par `CRON_SECRET`. C'est la **cadence en base** qui
décide si elle produit — changer de rythme se fait dans l'admin, sans
déploiement.

| Cadence (`blog.cadence`) | Génère si la dernière date d'au moins |
|---|---|
| `weekly` | 6 jours |
| `biweekly` *(par défaut)* | 13 jours |
| `monthly` | 27 jours |

Un jour de moins que la période : une génération finie à 7 h 00 min 40 s ne
doit pas faire manquer le lundi suivant.

Déroulé : verrou (`blog.generation_lock`, 5 min, pris en une seule instruction
SQL) → cadence due ? → moins de 2 brouillons ? → génération → email aux
administrateurs → rattrapage d'une couverture. Un échec de génération ne met
pas à jour `blog.last_generation_at` : le lundi suivant retente.

Chaque brouillon généré envoie **un** email « Un nouveau conseil attend ta
relecture » à tous les administrateurs actifs (sauf celui qui l'a demandé
depuis l'admin), avec le lien vers la fiche.

> **En attente** — « Rentrer ses plantes » est encore sur un dégradé de
> remplacement. Son article est en `coverStatus = PENDING` avec le prompt
> prêt : le premier passage du cron une fois la facturation Gemini activée le
> rattrapera.

## Où ça vit dans le code

| Fichier | Rôle |
|---|---|
| `apps/web/prisma/schema.prisma` | Modèles `BlogPost` et `AppSetting` (cadence, verrou de génération) |
| `apps/web/lib/blog/content.ts` | **Seul** module de lecture publique — articles `PUBLISHED` uniquement |
| `apps/web/lib/blog/mdx-components.tsx` · `mdx-options.ts` | Rendu MDX, web et HTML du mobile |
| `apps/web/lib/blog/editorial.ts` | Ton, interdits, calendrier saisonnier, prompts, lint — **fait foi** |
| `apps/web/lib/blog/compile.ts` | Compilation et rendu réels d'un corps, avant toute écriture |
| `apps/web/lib/services/blog-generator.service.ts` | Génération d'un brouillon, email aux admins |
| `apps/web/lib/services/blog-cover.service.ts` | Couverture : image, recadrage, dépôt |
| `apps/web/lib/services/app-settings.service.ts` | Cadence, dernière génération, verrou |
| `apps/web/app/api/cron/blog-generate/` | Le passage du lundi |
| `apps/web/lib/blog/cover-image.ts` | Mise au format d'une couverture |
| `apps/web/lib/storage.ts` | `uploadCover`, `deleteCoverByUrl` |
| `apps/web/app/(marketing)/blog/` | Pages liste et article |
| `apps/web/app/api/v1/blog/` | Les deux routes publiques du mobile |
| `packages/shared/src/schemas/blog.ts` | Contrat partagé, statuts, cadences, sortie du générateur |
