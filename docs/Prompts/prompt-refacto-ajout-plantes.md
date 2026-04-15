# Prompt — Refactoring des parcours d'ajout de plantes (page Plantes + page Jardin)

## Contexte

Le projet est une app Next.js (App Router, TypeScript, Tailwind, Prisma + Supabase).

Les server actions utiles **existent déjà** :
- `searchCatalog(query, category?)` → `lib/actions/catalog.actions.ts` — recherche dans `plant_catalog` (Prisma), retourne des `PlantCatalog[]`
- `addPlantToMyGarden(data)` → `lib/actions/plant.actions.ts` — si `data.catalogPlantId` est fourni, les champs techniques (arrosage, exposition, emoji) sont **auto-remplis depuis le catalogue**

Le formulaire actuel (`components/dashboard/plantes/PlantForm.tsx`, 365 lignes) est 100 % manuel : l'utilisateur saisit à la main le nom scientifique, la fréquence d'arrosage, l'exposition, etc. sans aucun lien avec la base de données.

---

## Objectif global

Remplacer le parcours d'ajout manuel par deux nouvelles expériences basées sur la BDD :
1. **Page Plantes** → formulaire avec recherche + autocomplétion dans `plant_catalog`
2. **Page Jardin** → quick-add dans le panneau latéral droit (`GardenPropsTab`) avec suggestions contextuelles par zone

---

## PARTIE 1 — Page Plantes : formulaire avec autocomplétion

### Fichiers à modifier / créer

| Fichier | Action |
|---|---|
| `components/dashboard/plantes/PlantSearchInput.tsx` | **Créer** — composant d'autocomplétion |
| `components/dashboard/plantes/PlantForm.tsx` | **Modifier** — intégrer le nouveau composant |
| `app/dashboard/plantes/nouveau/page.tsx` | **Modifier** — adapter le submit |

---

### 1.1 Créer `PlantSearchInput.tsx`

Composant client qui :
- Affiche un `<input>` texte avec `debounce` de 250 ms
- À chaque frappe ≥ 2 caractères, appelle la server action `searchCatalog(query)` et affiche un dropdown avec les résultats
- Chaque item du dropdown montre : emoji, nom commun, nom scientifique (italique), tags (`category`, fréquence d'arrosage, difficulté), et un badge rouge si `toxic === true`
- Supporte la navigation clavier (↑↓ Enter Escape)
- À la sélection d'un item : remonte au parent l'objet `PlantCatalog` sélectionné via `onSelect(plant: PlantCatalog | null)`
- Si 0 résultat : affiche "Plante non trouvée — saisie manuelle →" qui appelle `onFallback()`

Props :
```ts
interface PlantSearchInputProps {
  onSelect: (plant: PlantCatalog | null) => void
  onFallback: () => void
}
```

---

### 1.2 Modifier `PlantForm.tsx`

Le formulaire doit fonctionner en **deux modes** contrôlés par un state `mode: 'search' | 'manual'` :

**Mode `search` (défaut pour `/nouveau`) :**

Étape 1 — Trouver la plante  
- Afficher `<PlantSearchInput>` en haut du formulaire
- Quand une plante est sélectionnée : afficher une carte de prévisualisation avec emoji, nom, description courte, et les métadonnées clés (arrosage, exposition, difficulté)
- En dessous de la carte, afficher les champs **pré-remplis depuis le catalogue** en lecture seule avec un fond `bg-lime/10` (modifiables au clic) :
  - `scientificName` ← `catalogPlant.scientificName`
  - `wateringFrequencyDays` ← `catalogPlant.wateringFreqDays`
  - `sunExposure` ← `catalogPlant.sunExposure`
  - `wateringDifficulty` ← `catalogPlant.difficulty`
  - `emoji` ← `catalogPlant.emoji`

Étape 2 — Contexte (toujours en saisie libre) :
- `location` (select)
- `zone` (input texte)
- `datePlanted` (date)
- `healthStatus` (pills)
- `notes` (textarea)

**Mode `manual` (accessible via "Saisie manuelle" ou pour la page modifier) :**  
Conserver l'intégralité du formulaire actuel (comportement inchangé).

State interne clé :
```ts
const [selectedCatalogPlant, setSelectedCatalogPlant] = useState<PlantCatalog | null>(null)
const [mode, setMode] = useState<'search' | 'manual'>('search')
```

---

### 1.3 Modifier `app/dashboard/plantes/nouveau/page.tsx`

Au `handleSubmit`, si `selectedCatalogPlant` est défini, passer `catalogPlantId: selectedCatalogPlant.id` à `addPlantToMyGarden`. La server action se chargera d'appliquer les valeurs de la BDD.

---

## PARTIE 2 — Page Jardin : quick-add dans le panneau latéral

### Fichiers à modifier

| Fichier | Action |
|---|---|
| `components/dashboard/jardin/GardenPropsTab.tsx` | **Modifier** — ajouter section "Plantes de cette zone" |
| `components/dashboard/jardin/GardenCanvas.tsx` | **Modifier** — passer les plantes du catalogue au panneau |

---

### 2.1 Modifier `GardenPropsTab.tsx`

Ajouter une nouvelle section en bas du panneau, sous les propriétés de l'élément, visible quand `element.type === 'plante'` ou quand l'élément est une zone (`potager`, `massif`, `pelouse`, `serre`) :

**Section "Plantes de cette zone"**

1. Lister les plantes déjà liées à la zone (`plants` prop filtrées par `linkedPlantId === element.id` ou `zone.id`) — chaque item : emoji + nom + badge arrosage

2. **Barre de recherche rapide** : input `placeholder="Ajouter une plante…"` avec autocomplétion inline (même logique que `PlantSearchInput` mais compact — dropdown max 5 items, sans debounce)  
   - Appelle `searchCatalog(query)` en direct  
   - À la sélection : appelle `onAddPlant(catalogPlant)` → crée une `PlantInstance` liée à la zone via `addPlantToMyGarden({ catalogPlantId, location: 'OUTDOOR', gardenZoneId: element.id })`  
   - Afficher un toast de confirmation

3. **Suggestions contextuelles** : si `element.type === 'potager'` afficher 3 suggestions hardcodées ou issues d'une requête `searchCatalog('', 'VEGETABLE')`, cliquables directement pour ajouter en 1 clic

Nouvelle prop à ajouter :
```ts
onAddPlant?: (catalogPlant: PlantCatalog, zoneId: string) => Promise<void>
```

---

### 2.2 Modifier `GardenCanvas.tsx`

Passer la prop `onAddPlant` à `GardenRightPanel` → `GardenPropsTab`. Implémenter le handler :
```ts
async function handleAddPlantToZone(catalogPlant: PlantCatalog, zoneId: string) {
  await addPlantToMyGarden({
    catalogPlantId: catalogPlant.id,
    location: 'OUTDOOR',
    // gardenZoneId: zoneId  ← si le schéma Prisma le supporte, sinon stocker dans notes
  })
  // revalidatePath est appelé dans la server action
}
```

---

## Contraintes techniques

- Ne pas créer d'API route `fetch`. Utiliser les **server actions** existantes directement (appels depuis des composants client via `import … from '@/lib/actions/...'`)
- Respecter le design system existant : `bg-lime/10`, `border-lime`, `rounded-xl`, `font-poppins` / `font-raleway`, classes Tailwind du projet
- Le composant `PlantSearchInput` doit gérer le `loading` state (spinner ou point pulsant) pendant l'appel async
- Sur mobile (< md), le panneau latéral jardin n'est pas visible ; le quick-add doit aussi être accessible depuis la `Sheet` mobile existante dans `GardenCanvas`
- Garder le mode `manual` accessible : ne pas supprimer `PlantForm` mais le conditionner sur `mode === 'manual'`

---

## Ordre d'implémentation recommandé

1. `PlantSearchInput.tsx` (composant autonome, testable seul)
2. Modification de `PlantForm.tsx` (intégration + mode switch)
3. Test `app/dashboard/plantes/nouveau/page.tsx`
4. Section quick-add dans `GardenPropsTab.tsx`
5. Câblage dans `GardenCanvas.tsx`
