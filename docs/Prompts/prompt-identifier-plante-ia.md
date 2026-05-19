# Prompt Claude Code — Fonctionnalité "Identifier une plante" (vision IA OpenAI)

## Contexte du projet
App Next.js App Router (`growi-frontend/`), TypeScript strict, Tailwind avec tokens custom (forest #1E5631, lime #B4DD7F, sand #F9F7E8, sun #F6C445), polices font-poppins / font-raleway, Prisma, NextAuth. L'encyclopédie existe déjà à `/encyclopedie/[slug]`. Le catalogue de plantes est dans le modèle Prisma `PlantCatalog` avec les champs `slug`, `commonName`, `scientificName`, `aliases`.

## Objectif
Implémenter une fonctionnalité d'identification de plante par photo IA (OpenAI GPT-4o vision) avec :
1. Un CTA "Identifier" mis en avant sur la dashboard home page
2. Une page dédiée `/dashboard/identifier` avec upload photo + résultat formaté
3. Une API route sécurisée qui appelle OpenAI et cherche un match dans l'encyclopédie
4. Redirection vers la fiche encyclopédie si la plante est trouvée dans le catalogue

---

## Fichiers à créer / modifier

### 1. Variable d'environnement
Dans `.env.local`, ajouter :
```
OPENAI_API_KEY=<À_REMPLACER>
```
Ne pas oublier d'ajouter `OPENAI_API_KEY` dans `.env.example` (sans valeur).

---

### 2. API Route — `app/api/identify-plant/route.ts`

**Route** : `POST /api/identify-plant`

**Auth** : Vérifier la session via `auth()`. Retourner 401 si non authentifié.

**Body attendu** :
```ts
{ imageBase64: string }  // data URL base64, ex: "data:image/jpeg;base64,..."
```

**Logique** :
1. Valider que `imageBase64` est présent et commence par `data:image/`
2. Appeler OpenAI `gpt-4o` avec vision (voir system prompt ci-dessous)
3. Parser la réponse JSON retournée par le LLM
4. Chercher un match dans `PlantCatalog` via `prisma.plantCatalog.findFirst` sur `commonName`, `scientificName`, ou `aliases` (mode insensitive, contains)
5. Retourner la réponse enrichie avec `encyclopediaSlug` si trouvé

**System prompt OpenAI à utiliser EXACTEMENT** :
```
Tu es un expert botaniste de l'application Growi. Analyse la photo fournie et identifie la plante.

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans ```json, sans commentaires.

Schéma JSON attendu :
{
  "identified": true,
  "confidence": "high" | "medium" | "low",
  "commonName": "Nom commun en français",
  "scientificName": "Genre espèce",
  "family": "Famille botanique",
  "emoji": "Un emoji représentatif",
  "shortDescription": "Description courte en 1-2 phrases, ton accessible et chaleureux",
  "careGuide": {
    "watering": "Conseil arrosage concis",
    "light": "Besoin en lumière",
    "soil": "Type de substrat idéal",
    "temperature": "Plage de températures tolérées",
    "difficulty": "easy" | "medium" | "demanding"
  },
  "funFact": "Une anecdote originale ou un fait surprenant sur cette plante",
  "warnings": ["Liste de points d'attention (toxicité, allergènes, invasive...)"],
  "tags": ["tag1", "tag2", "tag3"]
}

Si tu ne peux pas identifier la plante (image floue, non-plante, ambiguïté forte), réponds :
{
  "identified": false,
  "reason": "Explication courte en français de pourquoi l'identification échoue"
}

Règles :
- commonName TOUJOURS en français
- scientificName en latin (Genre espèce)  
- shortDescription en français, 1-2 phrases max, ton bienveillant
- funFact original et mémorisable, pas générique
- Si plusieurs plantes visibles, identifier la plante principale au premier plan
- Ne pas inventer une espèce si tu n'es pas sûr — préférer confidence "low" avec best guess
```

**Modèle OpenAI** : `gpt-4o`, `max_tokens: 800`, `temperature: 0`

**Code de l'appel OpenAI** :
```ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  max_tokens: 800,
  temperature: 0,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<system prompt ci-dessus>',
        },
        {
          type: 'image_url',
          image_url: { url: imageBase64, detail: 'high' },
        },
      ],
    },
  ],
})
```

**Recherche catalogue** (après parsing du JSON LLM) :
```ts
const catalogMatch = result.identified
  ? await prisma.plantCatalog.findFirst({
      where: {
        OR: [
          { commonName:     { contains: result.commonName,     mode: 'insensitive' } },
          { scientificName: { contains: result.scientificName, mode: 'insensitive' } },
          { aliases:        { contains: result.commonName,     mode: 'insensitive' } },
        ],
      },
      select: { slug: true, commonName: true, emoji: true },
    })
  : null
```

**Réponse finale** :
```ts
return NextResponse.json({
  ...result,
  encyclopediaSlug: catalogMatch?.slug ?? null,
  encyclopediaName: catalogMatch?.commonName ?? null,
})
```

**Gestion d'erreurs** : Wrapper try/catch. Si `JSON.parse` échoue sur la réponse LLM, retourner `{ identified: false, reason: "Erreur d'analyse, veuillez réessayer." }` avec status 200 (pas 500, c'est une réponse valide du point de vue UI).

---

### 3. Page dashboard — `app/dashboard/identifier/page.tsx`

**Route** : `/dashboard/identifier`

Page **Client Component** (`'use client'`). Pas de metadata statique (page dynamique).

**States** :
```ts
type Step = 'upload' | 'loading' | 'result' | 'error'
const [step, setStep] = useState<Step>('upload')
const [preview, setPreview] = useState<string | null>(null)
const [result, setResult] = useState<IdentifyResult | null>(null)
const [errorMsg, setErrorMsg] = useState<string | null>(null)
```

**Définir le type `IdentifyResult`** correspondant exactement au JSON retourné par l'API.

#### Step "upload" :

Zone drag-and-drop + bouton "Choisir une photo" (input file accept="image/*"). Afficher une zone pointillée avec icône feuille (Leaf de lucide-react) et le texte :
- Titre : **"Identifiez votre plante"**
- Sous-titre : "Prenez ou importez une photo — l'IA fait le reste en quelques secondes"

Bouton **"Prendre une photo"** (sur mobile, `capture="environment"` sur l'input).
Bouton **"Choisir depuis la galerie"**.

Quand une image est sélectionnée :
1. Lire avec `FileReader.readAsDataURL`
2. Afficher la preview en `<Image>` Next.js (ou `<img>` si plus simple)
3. Afficher le bouton **"Analyser cette photo →"** (plein largeur, bg-forest text-white)

#### Step "loading" :

Spinner centré (ou animation pulse) + textes animés qui changent toutes les 2s :
- "Analyse de la photo en cours…"
- "Identification de l'espèce…"  
- "Consultation de l'encyclopédie…"
- "Rédaction de la fiche…"

#### Step "result" (plante identifiée) :

Afficher sous forme de **fiche plante** :

```
[Photo uploadée — 200px height, rounded-2xl object-cover]

[emoji + commonName en grand — font-poppins font-bold text-2xl text-forest]
[scientificName en italique — font-raleway text-sm text-forest/60]

Badge confidence : 
  "high" → bg-lime/20 text-forest "✓ Identification certaine"
  "medium" → bg-sun/20 text-forest "~ Identification probable"  
  "low" → bg-red-50 text-red-700 "? Identification incertaine"

[shortDescription — font-raleway text-sm text-forest/80]

Section "Guide d'entretien" (grid 2 cols) :
  💧 Arrosage  ☀️ Lumière  🪴 Substrat  🌡️ Températures

Badge difficulté : easy→"Facile 🟢" medium→"Moyen 🟡" demanding→"Exigeant 🔴"

[funFact dans un encadré bg-sand rounded-xl p-4 : "💡 Le saviez-vous ? {funFact}"]

[Si warnings.length > 0 : encadré bg-red-50 border border-red-200 avec ⚠️ + liste]

[Si encyclopediaSlug : bouton CTA plein largeur :
  → "Voir la fiche complète dans l'encyclopédie →"
  → href="/encyclopedie/{encyclopediaSlug}"
  → style bg-forest text-white]

[Bouton secondaire : "Identifier une autre plante" → reset à step 'upload']
```

#### Step "result" (plante non identifiée) :

Illustration (emoji 🔍 ou 🌿) + message :
- "Nous n'avons pas pu identifier cette plante"
- Afficher `result.reason`
- Bouton "Réessayer avec une autre photo"

#### Step "error" :

Message d'erreur générique + bouton retry.

---

### 4. Modifier `app/dashboard/page.tsx`

Ajouter la carte "Identifier" **en première position** du tableau `featureCards`, avec un style distinctif (badge "IA" + couleur d'accent) :

```ts
{
  href: '/dashboard/identifier',
  title: 'Identifier une plante',
  description: 'Photographiez n\'importe quelle plante pour obtenir sa fiche complète instantanément.',
  icon: ScanSearch,   // import depuis lucide-react
  badge: 'IA',
},
```

En plus des feature cards, ajouter un **hero CTA visuel** juste après le bloc "Overview stats", avant la grille de features. Ce bloc doit être accrocheur, fond bg-lime/10, avec :
- Icône `ScanSearch` (lucide) en grand (40px) dans un rond bg-forest
- Titre : **"Identifier une plante en photo"**
- Description : "Pointez votre caméra vers n'importe quelle plante. L'IA l'identifie et vous donne tous les conseils d'entretien."
- Bouton **"Identifier maintenant →"** → href `/dashboard/identifier`, style bg-forest text-white
- Ce bloc doit avoir `rounded-2xl border border-lime/30 p-6 flex gap-4 items-center`

---

### 5. Package à installer

```bash
npm install openai
```

Vérifier que `openai` n'est pas déjà présent dans `package.json` avant d'installer.

---

## Contraintes importantes

- **Sécurité** : L'API route doit TOUJOURS vérifier l'authentification via `auth()` avant d'appeler OpenAI. Retourner 401 immédiatement si pas de session.
- **Taille image** : Avant d'envoyer à OpenAI, vérifier que le base64 ne dépasse pas 4MB (retourner une erreur 400 claire si trop grand). Côté client, afficher un message si le fichier dépasse 4MB.
- **Variables d'env** : Ne JAMAIS exposer `OPENAI_API_KEY` côté client. L'appel OpenAI se fait UNIQUEMENT dans l'API route server-side.
- **Cohérence design** : Utiliser les classes Tailwind du design system existant (forest, lime, sand, sun). Polices font-poppins pour les titres/labels, font-raleway pour le corps de texte. Coins arrondis `rounded-2xl`. Ombres `shadow-card`.
- **Types TypeScript** : Définir une interface `IdentifyApiResponse` dans un fichier `lib/types/identify.ts` et l'importer dans l'API route ET la page.
- **Pas de dépendances externes supplémentaires** au-delà de `openai`.

---

## Ordre d'implémentation recommandé

1. `lib/types/identify.ts` — types partagés
2. `app/api/identify-plant/route.ts` — API route (tester avec curl)
3. `app/dashboard/identifier/page.tsx` — page UI complète
4. Modifier `app/dashboard/page.tsx` — ajouter CTA hero + carte feature

---

## Test rapide post-implémentation

```bash
# Vérifier que l'API refuse sans auth
curl -X POST http://localhost:3000/api/identify-plant \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"data:image/jpeg;base64,test"}' 
# → doit retourner {"error":"Non authentifié"} avec status 401

# Vérifier que la page existe
curl -I http://localhost:3000/dashboard/identifier
# → doit retourner 200 (ou 307 redirect si non connecté, selon middleware)
```
