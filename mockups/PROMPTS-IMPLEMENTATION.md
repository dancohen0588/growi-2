# Prompts d'implémentation — 4 évolutions plant catalog

> Stack : Next.js 14 App Router · TypeScript · Prisma · Tailwind · shadcn/ui · `@prisma/client`
> Répertoire de travail : `growi-frontend/`

---

## PROMPT 1 — Images catalogue sur `/dashboard/plantes`

```
Tu travailles sur le projet Growi (Next.js 14 App Router, TypeScript, Prisma, Tailwind, shadcn/ui).

### Objectif
Afficher la photo catalogue (`PlantCatalog.imageUrl`) sur les cards de la page `/dashboard/plantes`.

### Fichiers concernés
- `components/dashboard/plantes/PlantCard.tsx`
- `lib/plant-types.ts` (type Plant)
- `lib/actions/plant.actions.ts` (query Prisma)

### Modifications demandées

**1. `PlantCard.tsx` — zone image**

Remplace la zone photo/emoji actuelle par la logique suivante :
- Si `plant.photoUrl` → afficher (photo utilisateur, priorité maximale)
- Sinon si `plant.catalogPlant?.imageUrl` → afficher (photo catalogue)
- Sinon → emoji centré sur fond `bg-lime/10`

Utilise `<Image>` de Next.js :
```tsx
<Image
  src={src}
  alt={plant.name}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  className="object-cover"
  quality={75}
/>
```
La div parente doit avoir `position: relative` et `aspect-ratio: 4/3` ou `aspect-ratio: 1`.

Ajoute un badge "📚 Catalogue" (absolu, top-left, `text-[10px] bg-forest/70 text-white rounded-md px-1.5 py-0.5 backdrop-blur-sm`) si `plant.catalogPlantId != null` et que `plant.photoUrl` est null.

**2. `lib/actions/plant.actions.ts`**

Dans le `findMany` ou `findUnique` qui récupère les plantes de l'utilisateur, inclure :
```ts
include: {
  catalogPlant: {
    select: { imageUrl: true, commonName: true }
  }
}
```

**3. Type `Plant` dans `lib/plant-types.ts`**

Ajouter le champ optionnel :
```ts
catalogPlant?: { imageUrl: string | null; commonName: string } | null
```

### Contraintes
- Ne pas casser le comportement existant (fallback emoji conservé)
- Utiliser le domaine d'images dans `next.config.mjs` si les URLs viennent d'un CDN externe (ajouter si nécessaire)
- Lazy loading par défaut, `priority` uniquement sur les 3 premières cards (si tu implémentes un prop `priority`)
- Conserver les animations Framer Motion existantes dans `PlantsListView.tsx`

### Livrable
Fichiers modifiés uniquement, avec les diffs commentés.
```

---

## PROMPT 2 — Images dans l'autocomplete `/plantes/nouveau`

```
Tu travailles sur le projet Growi (Next.js 14 App Router, TypeScript, Prisma, Tailwind).

### Objectif
1. Afficher une **thumbnail** (64×64 px) dans chaque item de la liste déroulante de `PlantSearchInput`
2. Afficher l'**image en bannière** dans `CatalogPreviewCard` après sélection

### Fichiers concernés
- `components/dashboard/plantes/PlantSearchInput.tsx`
- `components/dashboard/plantes/PlantForm.tsx` (CatalogPreviewCard)
- `lib/actions/catalog.actions.ts` (Server Action `searchCatalog`)

### Modifications demandées

**1. `catalog.actions.ts` — inclure `imageUrl` dans la projection**
```ts
select: {
  id: true, commonName: true, scientificName: true,
  emoji: true, category: true, wateringFreqDays: true,
  wateringDifficulty: true, sunExposure: true, toxic: true,
  imageUrl: true  // ← ajouter
}
```

**2. `PlantSearchInput.tsx` — item avec thumbnail**

Dans la liste `<ul role="listbox">`, chaque `<li>` doit avoir la structure :
```
[div 64×64 image ou emoji] [div texte existant]
```
- La div image : `w-16 h-16 shrink-0 overflow-hidden bg-lime/10`
- Si `plant.imageUrl` : `<Image src={plant.imageUrl} width={64} height={64} alt={plant.commonName} className="w-full h-full object-cover" quality={60} />`
- Sinon : emoji centré en `text-3xl`
- L'item actif garde `bg-lime/10` comme aujourd'hui

**3. `PlantForm.tsx` — CatalogPreviewCard avec bannière image**

Modifier `CatalogPreviewCard` pour afficher l'image en haut :
- Si `plant.imageUrl` : ajouter `<Image src={plant.imageUrl} alt={plant.commonName} width={480} height={160} className="w-full h-40 object-cover rounded-t-2xl" />` avant le `div` intérieur
- Retirer le `text-5xl emoji` de la gauche si une image est présente (garder comme fallback)
- Conserver les `MetaBadge` existants

### Contraintes
- Ajouter le domaine d'images dans `next.config.mjs` si nécessaire
- Ne pas modifier la logique de sélection / KeyDown existante
- La performance compte : `quality={60}` pour les thumbnails de liste, `quality={80}` pour la preview card

### Livrable
Fichiers modifiés uniquement. Inclure le diff de `next.config.mjs` si un domaine d'image doit être ajouté.
```

---

## PROMPT 3 — Palette Plantes du canvas "Mon jardin" driven par la DB

```
Tu travailles sur le projet Growi (Next.js 14 App Router, TypeScript, Prisma, Tailwind).

### Objectif
Remplacer la section "Plantes" hardcodée dans `lib/garden/palette.ts` par une liste dynamique
chargée depuis la base de données `PlantCatalog`, avec :
- Un **dropdown de catégorie** (filtrage par `PlantCatalog.category`)
- Un **champ de recherche** (filtrage texte côté client, debounce 200ms)
- Des **thumbnails** d'images dans chaque item draggable
- Pagination légère (afficher 10 puis "Charger plus")

### Fichiers concernés
- `components/dashboard/jardin/GardenPalette.tsx`
- `components/dashboard/jardin/GardenPaletteSection.tsx`
- `lib/garden/palette.ts`
- Nouvelle Server Action : `lib/actions/catalog.actions.ts` → `getCatalogByCategory`

### Architecture proposée

**1. Nouveau composant : `components/dashboard/jardin/GardenPalettePlants.tsx`**

Client Component qui :
- Garde l'état `category: string` (défaut `"all"`) et `query: string`
- Appelle une Server Action `getCatalogByCategory(category, query, limit)` avec `useTransition`
- Affiche le dropdown catégorie (enum values : ALL | INDOOR | VEGETABLE | FLOWERS | TREES_SHRUBS | HERBS | SUCCULENTS | AQUATIC | CLIMBING)
- Affiche un `<input>` de recherche avec debounce 200ms
- Affiche chaque plante comme un item draggable :

```tsx
<div
  draggable
  onDragStart={e => {
    e.dataTransfer.setData('palette-item', JSON.stringify({
      type: 'plante',
      emoji: plant.emoji ?? '🌿',
      label: plant.commonName,
      defaultWidth: 60,
      defaultHeight: 60,
      isCircular: true,
      catalogId: plant.id,
    }))
  }}
>
```

Format visuel de chaque item (voir mockup 03) :
- Thumbnail 36×36 px (`imageUrl` ou emoji fallback)
- Nom commun (truncate)
- Sous-label `💧 Xj · ☀️/⛅/🌥️`
- Icône grip `⠿` à droite

**2. `getCatalogByCategory` Server Action**
```ts
'use server'
export async function getCatalogByCategory(
  category: string,
  query: string,
  limit = 10,
  offset = 0,
) {
  return prisma.plantCatalog.findMany({
    where: {
      ...(category !== 'all' ? { category } : {}),
      ...(query.trim() ? {
        OR: [
          { commonName: { contains: query, mode: 'insensitive' } },
          { scientificName: { contains: query, mode: 'insensitive' } },
        ]
      } : {}),
    },
    select: {
      id: true, commonName: true, scientificName: true,
      emoji: true, imageUrl: true, category: true,
      wateringFreqDays: true, sunExposure: true,
    },
    orderBy: { commonName: 'asc' },
    take: limit,
    skip: offset,
  })
}
```

**3. `GardenPalette.tsx`**

Dans la section "Plantes" (index 2 du `PALETTE_CATALOG`), remplacer `GardenPaletteSection` par `<GardenPalettePlants />`.

Garder les autres sections (Structures, Zones, Arbres, Eau & Équipements) inchangées avec leurs items statiques.

**4. `lib/garden/palette.ts`**

Supprimer la section `'Plantes'` de `PALETTE_CATALOG` (elle est maintenant dynamique).

### Contraintes
- Le drag-and-drop existant doit continuer à fonctionner sans modification de `GardenCanvas.tsx`
- Si `getCatalogByCategory` échoue, afficher un fallback silencieux (les 8 plantes hardcodées actuelles)
- Lazy loading : charger les données uniquement au premier expand de la section
- Ne pas modifier la section "Arbres" (déjà dans PALETTE_CATALOG statique)

### Livrable
Nouveaux fichiers + fichiers modifiés, avec commentaires sur les points d'intégration.
```

---

## PROMPT 4 — Page Encyclopédie `/encyclopedie` + `/encyclopedie/[slug]`

```
Tu travailles sur le projet Growi (Next.js 14 App Router, TypeScript, Prisma, Tailwind, shadcn/ui).

### Objectif
Créer une section publique "Encyclopédie des plantes" accessible sans authentification :
- `/encyclopedie` : répertoire des 527+ plantes avec filtres, recherche, nav alphabétique
- `/encyclopedie/[slug]` : fiche détaillée par plante

### Pourquoi `/encyclopedie` et pas `/wikiplant`
- Meilleur SEO français ("encyclopédie plantes jardin")
- Plus naturel pour le public cible
- Cohérent avec le positionnement premium de Growi

### Routing Next.js

Créer le groupe `app/(public)/` avec son propre `layout.tsx` (nav publique sans auth) :
```
app/
  (public)/
    layout.tsx        ← layout sans sidebar dashboard, avec nav marketing
    encyclopedie/
      page.tsx        ← liste paginée (ISR, revalidate: 86400)
      [slug]/
        page.tsx      ← fiche plante (generateStaticParams + generateMetadata)
```

Modifier `middleware.ts` pour que `/encyclopedie` et `/encyclopedie/*` soient **publics** (pas de redirect vers login).

### Modèle Prisma — ajouter champ `slug`

Dans `schema.prisma`, ajouter sur `PlantCatalog` :
```prisma
slug String? @unique
```

Créer une migration. Générer les slugs depuis `commonName` (ex. "Tomate cerise" → "tomate-cerise").
Ajouter une fonction `generateSlug(name: string): string` dans `lib/utils.ts` ou `lib/slug.ts`.

### Page `/encyclopedie/page.tsx`

**Server Component** avec les éléments suivants :

1. **Hero** : titre "Encyclopédie des plantes", compteur total, barre de recherche (client-side via `useRouter` + searchParams)

2. **Filtres** (searchParams) :
   - `category` : all | INDOOR | VEGETABLE | FLOWERS | TREES_SHRUBS | HERBS | SUCCULENTS | AQUATIC | CLIMBING
   - `sun` : all | FULL_SUN | PARTIAL | SHADE
   - `q` : texte libre
   - `letter` : lettre alphabétique
   - `sort` : name_asc (défaut) | difficulty_asc | watering_asc

3. **Stats bar** : nombre total, nombre de comestibles, nombre de toxiques

4. **Navigation alphabétique** : A–Z, les lettres actives (qui ont des résultats) sont mises en valeur

5. **Grille 4 colonnes** (desktop) → 2 (tablette) → 1 (mobile) :
   - Chaque card : image `aspect-ratio: 3/2`, nom commun, nom scientifique, tags (catégorie, arrosage, difficulté, comestible/toxique)
   - Lien vers `/encyclopedie/[slug]`

6. **Pagination** : `?page=N`, 48 plantes par page (ou bouton "Charger plus" en client-side avec `limit/offset`)

**Server Action / Query** :
```ts
const plants = await prisma.plantCatalog.findMany({
  where: {
    ...(category !== 'all' ? { category } : {}),
    ...(q ? { OR: [{ commonName: { contains: q, mode: 'insensitive' } }, { scientificName: { contains: q, mode: 'insensitive' } }] } : {}),
    ...(letter ? { commonName: { startsWith: letter, mode: 'insensitive' } } : {}),
  },
  select: { id: true, slug: true, commonName: true, scientificName: true, emoji: true, imageUrl: true, category: true, wateringFreqDays: true, wateringDifficulty: true, edible: true, toxic: true },
  orderBy: { commonName: 'asc' },
  take: 48,
  skip: (page - 1) * 48,
})
```

### Page `/encyclopedie/[slug]/page.tsx`

**`generateStaticParams`** : récupérer tous les slugs non-null pour le pré-rendu statique.

**`generateMetadata`** : title = `"{commonName} | Encyclopédie Growi"`, description = `descriptionShort`, openGraph image = `imageUrl`.

**Contenu de la fiche** :
1. Hero image pleine largeur (`h-72 object-cover`) avec overlay gradient + nom + nom latin + badges
2. Bouton CTA "Ajouter à mon jardin" → `/dashboard/plantes/nouveau?catalogId={id}` (lien protégé par auth, redirect vers login si non connecté)
3. Section "Description" : `descriptionLong` ou `descriptionShort`
4. Section "Guide d'entretien" : tableau (arrosage, exposition, température, substrat, engrais, taille) depuis les champs Prisma
5. Section "Calendrier cultural" : si `fertilizerMonths` est disponible, visualisation 12 mois
6. Section "Associations bénéfiques" : si `tags` contient des données d'association (ou placeholder "à venir")
7. Sidebar : quick facts + CTA + "Plantes similaires" (même catégorie, 3 suggestions)

### SEO & performance
- `robots.txt` : autoriser `/encyclopedie/`
- `sitemap.ts` dans `app/sitemap.ts` : inclure toutes les fiches plantes
- Images : domaine configuré dans `next.config.mjs`, `sizes="(max-width: 768px) 100vw, 50vw"`
- Breadcrumb JSON-LD structuré

### Contraintes
- Section entièrement publique (pas de données utilisateur)
- Réutiliser les tokens Tailwind existants (forest, lime, sand) et les fonts (Poppins, Raleway)
- Ne PAS réutiliser le DashboardLayout — créer un layout marketing léger
- Le lien "Ajouter à mon jardin" doit fonctionner même si l'utilisateur n'est pas connecté (redirect vers `/login?redirect=/dashboard/plantes/nouveau?catalogId=xxx`)

### Livrable
Tous les nouveaux fichiers + migration Prisma + modifications `middleware.ts` et `next.config.mjs`.
Fichiers à créer :
- `app/(public)/layout.tsx`
- `app/(public)/encyclopedie/page.tsx`
- `app/(public)/encyclopedie/[slug]/page.tsx`
- `lib/slug.ts`
- `app/sitemap.ts` (ou mise à jour)
```

---

## Ordre d'exécution recommandé

1. **Prompt 2 d'abord** (autocomplete images) — changement le plus petit, test rapide
2. **Prompt 1** (dashboard plantes) — dépend du même `imageUrl` déjà inclus
3. **Prompt 3** (palette jardin) — introduces Server Actions, tester le drag-drop
4. **Prompt 4** (encyclopédie) — le plus large, impacte routing + SEO + auth
