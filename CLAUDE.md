# CLAUDE.md — Growi : App de gestion de jardins (B2C + B2B)

Ce fichier guide Claude Code (claude.ai/code) sur ce repository. Il combine la **vision produit** (haut) et les **conventions techniques de la codebase actuelle** (bas).

---

## Vision produit

**Growi** est une application mobile (React Native) + backend (Node/TypeScript) de gestion de jardins, à la fois grand public (B2C) et professionnelle (B2B). Elle se différencie des apps existantes (Planta, PictureThis, Blossom) par :

1. **Cartographie contextuelle du jardin** (zoning, exposition, micro-climats) + plan d'entretien jour-par-jour relié à la météo locale.
2. **Store contextuel** : produits/fournitures recommandés au bon moment et en bonnes quantités.
3. **Place de marché de services** (élagage, arrosage enterré, création de massifs) + réseau social local (échange graines/récoltes).

---

## Marché & positionnement

- Jardinage grand public monde : ~120 Md$ (2024), ~150 Md$ d'ici 2030.
- Home gardening monde : ~15,8 Md$ (2025), ~26,5 Md$ en 2034 (CAGR ~5,9%).
- France : marché du jardin ~7,7–8 Md€ (retail + e-commerce), part online croissante.
- Concurrents directs : Planta (>10M utilisateurs), PictureThis, Blossom — tous sur le seul entretien individuel de plantes, sans cartographie ni marketplace de services.

---

## Personas cibles

### B2C — Particuliers

| Persona | Profil | Besoin principal |
|---|---|---|
| **Julie** (32 ans, appartement/balcon) | Urbaine, CSP+, 5–10 plantes, pas experte | Identification photo, rappels visuels, partage communautaire |
| **Marc** (45 ans, maison 200m²) | Proprio débordé, veut automatiser | Planning météo, alertes, accès pros pour gros travaux |
| **Pierre** (60 ans, potager 100m²) | Passionné, suit cycles lunaires | Calendrier potager précis, journal d'entretien, communauté locale |

### B2B — Professionnels

| Persona | Profil | Besoin principal |
|---|---|---|
| **Laurent** (syndic copropriétés) | Gère 20 résidences, budgets serrés | Tableau de bord, preuves photo, rapports PDF |
| **Isabelle** (collectivité, ville moyenne) | Supervise parcs et équipes | Cartographie multi-sites, reporting ESG, indicateurs RSE |
| **Youssef** (chef d'équipe jardinage) | 3 équipes, 25 clients, tout sur mobile | Planning checklists, rapports photo automatiques, facturation |

---

## Stack technique cible

- **Frontend (cible)** : React Native (iOS + Android) — *codebase actuelle : Next.js 14 App Router, voir section "Codebase actuelle" en bas.*
- **Backend** : Node.js / TypeScript
- **Cartographie** : WebGL/Canvas (photo + croquis → vectorisation), GPS approximatif, import cadastre/IGN (open data)
- **IA** : Modèle vision (identification + diagnostic maladies), transfert learning
- **Météo** : Open-Meteo / Meteomatics
- **Paiements** : Stripe Connect (marketplace services)
- **IoT (optionnel)** : Sondes humidité sol, API HomeKit/Google Home

---

## Architecture fonctionnelle

### Modules B2C
- Onboarding : adresse → orientation/météo + croquis du jardin (zones : pelouse, massifs, potager, terrasse)
- Identification photo (catalogue 2–5k espèces en V1)
- Rappels dynamiques : fiche plante × météo × substrat × contenance pot × exposition
- Store contextuel v1 : affiliation (Amazon/Truffaut/Jardiland/pépinières)
- Journal photos avant/après
- Diagnostic maladies/nuisibles (IA + arbre de décision) + télé-conseil expert
- Calendrier potager (semis/récolte par zone climatique)
- Gamification (défis saisonniers, badges)
- Réseau social local (échange graines/récoltes, événements voisins)

### Modules B2B
- Cartographie multi-sites et parcs (plans géolocalisés, zones, surfaces, essences)
- Plan d'entretien annuel par site (tâches calées sur météo locale)
- Ordres de travail & tournées (tickets, SLA, checklists photo, routage offline)
- Gestion des marchés & devis (BPU/DPGF, reconductions)
- Suivi qualité & conformité (audits terrain, non-conformités, rapports PDF)
- Stocks & achats (terreau, engrais, traçabilité "peat-free / zéro phyto")
- Diagnostic agronomique (IA + télé-expert)
- IoT : sondes humidité sol, débitmètres, alertes fuite/stress hydrique
- Indicateurs ESG & biodiversité (surfaces perméables, espèces mellifères, consommation eau)
- Portail donneur d'ordres (syndic/mairie : validation OTs, signature électronique)

---

## Modèle économique

### B2C
| Source | Détail |
|---|---|
| Abonnement Premium | 2,99–5,99 €/mois (Indoor) / 6,99–9,99 €/mois (Garden Pro) |
| Affiliation e-commerce | 4–10% du panier (terreau, engrais, poterie, irrigation, outillage) |
| Marketplace services | Commission 10–15% / mission |
| Télé-conseil expert | 9–19 € / session |
| Data/Partenariats | Leads qualifiés pour enseignes, assurances |

**Unit éco B2C** : CAC 10–20 €/abonné, ARPU mensuel 3–6 €, LTV 35–90 €, payback < 3 mois.

### B2B
| Offre | Prix |
|---|---|
| Starter (Copro) | 99 €/site/mois (≤2 ha, 5 utilisateurs) |
| Pro (Parc & Prestataires) | 149 €/site/mois (≤10 ha, 15 utilisateurs) |
| Collectivités+ | 0,08 €/m²/an (plafond négocié, SSO, SLA 99,9%) |
| Add-on IoT | 5 €/capteur/mois |
| Add-on Télé-expert | 29 €/site/mois |
| Add-on API temps réel | 199 €/mois/compte |

**ARPA moyen B2B visé** : ~1 788 €/site/an. Payback ~3,1 mois (CAC 400 €), ~6–7 mois pour collectivités.

---

## P&L prévisionnel (B2B + B2C)

| | Y1 | Y2 |
|---|---|---|
| Revenus B2B SaaS | 178 800 € | 1 044 192 € |
| Revenus B2C abonnements | 360 000 € | 720 000 € |
| Affiliation & services | 100 000 € | 300 000 € |
| **Total Revenus** | **638 800 €** | **2 064 192 €** |
| Marge brute (mix) | 540 568 € | 1 741 605 € |
| Opex | 880 000 € | 1 232 000 € |
| **EBIT** | **–339 432 €** | **+509 605 €** |

Seuil de rentabilité atteint en Y2 (scénario base).

---

## Roadmap produit (18 mois)

### Phase 0 — M0–M2 : MVP "Indoor + petit jardin"
- Onboarding (adresse → orientation/météo), croquis rapide du jardin
- Identification photo top 500 espèces + base d'entretien (eau/lumière/substrat)
- Rappels dynamiques + notifications météo (gel/canicule)
- Store contextuel v1 (affiliation) + journal photos
- Analytics & instrumentation KPIs

### Phase 1 — M3–M6 : Valeur perçue & rétention
- Cartographie avancée (calques exposition, arrosage, suggestions automatiques)
- Diagnostic maladies/nuisibles v1 (IA + arbre décision) + télé-conseil expert
- Calendrier potager (semis/récolte par zone climatique) + to-dos hebdo
- Gamification (défis saisonniers, badges)
- Marketplace services v1 : annuaire + demande de devis (sans paiement in-app)
- Bundles dans le store (kit rempotage, kit rosiers)

### Phase 2 — M7–M12 : Monétisation & scale
- Premium (diagnostics illimités, météo pro, multi-jardins, export PDF)
- Paiement in-app des prestations (Stripe Connect), gestion créneaux & devis comparés
- Recommandations intelligentes (prédiction besoins eau/engrais par plante et météo)
- Programmes partenaires (enseignes, pépinières) & coupons

### Phase 3 — M13–M18 : Réseau & moat
- Réseau social local (partage récoltes, échanges graines, événements voisins)
- Automations (arrosage connecté via HomeKit/Google Home), API capteurs humidité sol
- Catalogue long tail 5–10k espèces + modèles régionaux
- Pro features (micro-entrepreneurs : CRM simple, devis, factures)

### Roadmap B2B parallèle
- **M0–M3** : Import cadastres/plan DWG, carto multi-sites, planning annuel, OTs avec preuves photo, PDF copro. 5 pilotes (2 syndics, 2 prestataires, 1 ville moyenne).
- **M4–M8** : Tournées géo-optimisées, SLA & pénalités, BPU/DPGF, portail donneur d'ordres, pack Collectivités.
- **M9–M12** : Paiements intégrés (Stripe Connect), IoT, tableau ESG & biodiversité, marketplace pro.
- **M13–M18** : Modèles prédictifs (météo + espèces + sols), API SIG/urbanisme, connecteurs GMAO/ERP.

---

## KPIs à suivre

### B2C
- Activation J+7 : % jardins cartographiés + ≥3 plantes ajoutées
- WAU/MAU & rétention M3/M6 par segment
- Taux free→paid & ARPU par persona
- Taux de résolution (problèmes plantes) & NPS
- Taux de conversion marketplace (devis→commande) & panier moyen
- % recommandations store contextuel cliquées

### B2B
- Time-to-value (jours jusqu'au 1er rapport validé)
- Taux d'adoption mobile (OTs clôturés via app)
- Productivité (OTs / heure / agent)
- Litiges & non-conformités (nbre & €)
- Consommation d'eau (m³/ha) vs baseline
- Churn logo & expansion (upsell add-ons, nouveaux sites)
- CAC & payback par segment (copro vs collectivité)

---

## Go-to-market

### B2C (France → UE)
- ASO sur "arrosage plantes", "identifier plante", "entretien jardin", "calendrier potager"
- Influenceurs jardin & DIY (YouTube/TikTok/Instagram), UGC avant/après
- Packs co-brandés (sacs terreau, semences) avec QR code → onboarding direct
- Partenariats retail (enseignes jardinage) pour leads services + offres premium 3 mois
- Saisonnalité : vagues mars–mai et sept–oct ; push "indoor" en hiver
- SEO : "calendrier d'entretien par code postal", "diagnostic maladies rosiers"

### B2B
- Outbound ciblé (syndics top 50, bailleurs sociaux, top 2 000 communes), ROI deck
- Channel : intégrateurs IoT, pépinières, réseaux d'entreprises d'espaces verts (rev-share 15–20%)
- Marchés publics : POC 1–3 sites sur 6 mois, puis marchés cadres, centrales d'achat
- Cycle & CAC : copro/prestataire 2–3 mois / CAC ~400€ ; collectivité 6–9 mois / CAC ~800€

---

## Équipe cible (noyau Y1 — 6–8 ETP)

- 1 PM
- 2 Mobile (React Native)
- 1 Backend
- 1 Data/ML
- 1 UX
- 1 Contenu horticole
- 0,5 Ops/partenariats
- +2 AEs B2B + 1 CSM (dès M4)

---

## Risques clés & parades

| Risque | Parade |
|---|---|
| Qualité diagnostic IA (pathologies proches) | Combo IA + validation humaine (experts télé-consult) |
| Saisonnalité (churn hors saison) | Contenus indoor, calendriers potager, abos annuels |
| Monétisation lente B2C | Compenser par B2B2C (enseignes jardinage, assurances, serres) |
| Longueur cycles publics B2B | Pipeline 3×, pilotes sponsorisés, références croisées |
| Churn prestataires B2B | Ancrer via portail donneur d'ordres & intégrations ERP/GMAO |

---

# Codebase actuelle — monorepo pnpm + Turborepo

## Structure du repo

```
growi-2/
├── apps/
│   └── web/            # Next.js 14 marketing + auth + dashboard (App Router) — ex growi-frontend
├── packages/
│   ├── shared/         # @growi/shared : types TS, schémas Zod, constantes métier
│   └── api-client/     # @growi/api-client : client typé de l'API v1
├── docs/               # Specs et plans d'implémentation
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json  # config TS commune, étendue par chaque package
```

`apps/mobile` (Expo) arrivera à la phase 4 du plan mobile.

Pas de backend séparé : les Server Actions Next.js + Prisma jouent ce rôle, et l'API REST
`/api/v1/*` consommée par le mobile vivra dans `apps/web`.

**Gestionnaire de paquets : pnpm** (obligatoire — workspaces). Ne pas utiliser npm/yarn à la racine.

### Conventions monorepo

- Un package = un `package.json` avec un `name` (`web`, `@growi/shared`, à venir `mobile`, `@growi/api-client`).
- Dépendances internes déclarées en `"@growi/shared": "workspace:*"`.
- `packages/*` sont des packages « source-first » : pas d'étape de build, on importe le TS
  directement (`transpilePackages` côté Next.js, Metro/Babel côté Expo).
- pnpm est strict : **toute dépendance importée doit être déclarée** dans le `package.json` du
  package qui l'importe (pas de hoisting implicite comme avec npm).
- Nouveau package : l'ajouter sous `apps/` ou `packages/`, étendre `tsconfig.base.json`, exposer
  les scripts `build` / `lint` / `typecheck` / `test` pour qu'ils soient pris par Turborepo.

### `@growi/shared`

Source de vérité du domaine, consommée par le web et (à venir) le mobile :

| Module | Contenu |
|---|---|
| `constants/enums.ts` | Valeurs métier telles que stockées en base (`GARDEN_TYPES`, `PLANT_LOCATIONS`, `SUN_EXPOSURES`, `HEALTH_STATUSES`, `PLANT_CATEGORIES`, `CARE_LOG_TYPES`…) + libellés français |
| `schemas/user.ts` | `alertConfigSchema` et `DEFAULT_ALERT_CONFIG`, `publicUserSchema` (jamais de `password`), `userProfileSchema`, `updateProfileSchema`, et les schémas de formulaires `loginSchema` / `registerSchema` / `profilSchema` / `changePasswordSchema` |
| `schemas/garden.ts` | `gardenSchema`, `gardenZoneSchema` + DTOs de création/mise à jour |
| `schemas/plant.ts` | `plantCatalogSchema`, `plantInstanceSchema` + DTOs (`createPlantInstanceSchema`, `addIdentifiedPlantSchema`) |
| `schemas/logs.ts` | Les 4 types de logs d'entretien + `createCareLogSchema`, union discriminée par `type` pour l'endpoint unifié de l'API v1 |
| `schemas/common.ts` | `idSchema`, `isoDateTimeSchema`, helper `nullish()`, enveloppes `{ data }` / `{ error }` de l'API v1 |

Deux conventions à respecter :

- Les schémas d'**entité** décrivent la représentation **JSON de l'API** (dates en chaînes ISO).
  Côté web, les Server Components manipulent encore des `Date` Prisma : la conversion sera faite
  par la couche de sérialisation des routes `/api/v1/*`.
- Les valeurs du domaine sont en MAJUSCULES (`OUTDOOR`, `HEALTHY`, `FULL_SUN`). Le web garde en
  parallèle des types de **présentation** en minuscules et en français dans `lib/plant-types.ts` ;
  `lib/plant-mapper.ts` convertit des uns vers les autres. Les deux jeux portent volontairement les
  mêmes noms de types — ne pas les confondre lors d'un import.

Tests du package : `pnpm --filter @growi/shared test` (Vitest, sans fichier de config).

### `@growi/api-client`

Client TypeScript de l'API v1, destiné au mobile et utilisable depuis le web.
Voir `packages/api-client/README.md` pour l'usage détaillé.

```ts
const api = createGrowiApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_URL!,
  getAccessToken: () => SecureStore.getItemAsync('accessToken'), // phase 3
  onUnauthorized: refreshAccessToken, // true => la requête est rejouée une fois
})
await api.gardens.list()
```

- Une méthode par endpoint (`gardens`, `plants`, `planning`, `me`, `identify`), typée avec
  `@growi/shared` en entrée comme en sortie.
- Toute défaillance remonte en `ApiError` (`isNotFound`, `isUnauthorized`, `isNetworkError`…),
  y compris les pannes réseau et les réponses non-JSON.
- `fetch` est injectable, ce qui rend les tests indépendants du réseau.

Tests : `pnpm --filter @growi/api-client test`.

## Commandes

Depuis la **racine** du repo :

```bash
pnpm install                # Installe tout le monorepo
pnpm --filter web dev       # Dev server web (localhost:3000)
pnpm --filter web build     # Production build web
pnpm --filter web lint      # ESLint web
pnpm --filter web test      # Vitest
pnpm --filter web e2e       # Playwright
pnpm build                  # Turborepo : build de tous les packages
pnpm typecheck              # Turborepo : tsc --noEmit partout
```

Tests : Vitest (`vitest.config.ts`) et Playwright (`playwright.config.ts`, dossier `e2e/`),
tous deux dans `apps/web`.

> Note : `pnpm --filter web lint` remonte 15 erreurs ESLint pré-existantes
> (`no-explicit-any`, variables inutilisées). Le build les ignore volontairement
> (`eslint.ignoreDuringBuilds`). À traiter séparément, hors migration monorepo.

## Architecture

### Next.js App Router

Deux route groups partagent le `app/layout.tsx` racine (SessionProvider, Google Fonts) :

- `(marketing)/` — pages publiques avec `Header` + `Footer` via son propre layout (homepage, fonctionnalités, pro, tarifs, blog)
- `(auth)/` — login/register en plein écran, robots `noindex`
- `(public)/` — pages publiques additionnelles
- `dashboard/` — protégé par middleware (catalogue, plantes, jardin, calendrier, météo, identifier, paramètres)

### Design system

Palette Growi définie dans `tailwind.config.ts`, mappée à des variables shadcn dans `globals.css` :

| Token | Hex | Usage |
|-------|-----|-------|
| `lime` | `#B4DD7F` | Primary CTA, highlights |
| `forest` | `#1E5631` | Texte, sections sombres |
| `sand` | `#F9F7E8` | Background par défaut |
| `sun` | `#F6C445` | Accent/badge |

Typo : `font-poppins` pour les titres, `font-raleway` pour le body (via CSS variables).

Ombres custom : `shadow-card`, `shadow-card-hover`, `shadow-cta`.

### Conventions de composants

- **`SectionWrapper`** (`components/ui/section-wrapper.tsx`) — à utiliser pour chaque section marketing. Gère `py-20 md:py-28`, `max-w-7xl` container, animations Framer Motion au scroll. Prop `variant` : `sand | white | forest | gradient`.
- **Animations** (`lib/animations.ts`) — variants Framer Motion `fadeUp`, `fadeIn`, `scaleIn`, `staggerContainer`. Toujours respecter `useReducedMotion()`.
- **Primitives UI** (`components/ui/`) — base shadcn : `Button`, `Badge`, `Card`, `Carousel`, `Sheet`, `Separator`, `AppMockup`.

### Auth & DB

- **NextAuth v5 (beta)** dans `auth.ts` avec un Credentials provider backé par Prisma (`lib/prisma.ts`).
- **JWT session strategy**. Type session étendu pour inclure `user.firstName` et `user.id`.
- **Middleware** : protège `/dashboard/**` uniquement (`auth.config.ts` séparé pour compat Edge Runtime).
- **Prisma + Supabase** : schema dans `prisma/schema.prisma`, migrations dans `prisma/migrations/`.

### Couche services et API v1

Depuis l'étape 2.1 du plan mobile, la logique métier vit dans `apps/web/lib/services/` :
`garden`, `plant`, `log`, `user`, `weather`, `advice`, `planning`, `identify`.

- **Un service ne lit jamais la session** : le `userId` est toujours un paramètre. Ce sont les
  Server Actions et les routes qui authentifient.
- Un service lève une `ServiceError` porteuse d'un code stable (`NOT_FOUND`, `CONFLICT`,
  `UNAUTHENTICATED`, `INVALID_INPUT`, `UNAVAILABLE`…) ; `SERVICE_ERROR_STATUS` donne le statut
  HTTP correspondant. Aucune connaissance de HTTP ni de Next.js dans les services.
- Les services renvoient les entités Prisma brutes ; la conversion est faite en bout de chaîne
  par `lib/plant-mapper.ts` (présentation web) ou `lib/api/serializers.ts` (JSON de l'API).

Les routes `/api/v1/*` (`apps/web/app/api/v1/`) sont la surface consommée par le mobile :

| Route | Méthodes |
|---|---|
| `/api/v1/gardens` | GET, POST |
| `/api/v1/gardens/[id]` | GET, PATCH, DELETE |
| `/api/v1/gardens/[id]/plants` | GET, POST |
| `/api/v1/plants/[id]` | GET, PATCH, DELETE |
| `/api/v1/plants/[id]/logs` | GET, POST (union discriminée par `type`) |
| `/api/v1/planning/today` | GET |
| `/api/v1/me` | GET, PATCH |
| `/api/v1/identify` | POST |
| `/api/v1/auth/register` · `/login` · `/refresh` · `/logout` | POST |

Chaque route suit le même squelette, à respecter pour toute nouvelle route :

```ts
export const dynamic = 'force-dynamic'   // routes authentifiées, jamais statiques

export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()                      // lib/api/auth-context
  const input = await parseJsonBody(request, someSchema)    // schéma de @growi/shared
  return created(serializeX(await someService.create(userId, input)))
})
```

- **Enveloppes** : succès `{ data }`, erreur `{ error: { code, message } }`. 201 à la création,
  204 à la suppression.
- **`lib/api/auth-context.ts`** est le seul endroit qui sait comment on authentifie. Il accepte un
  access token JWT en `Authorization: Bearer …` (mobile) **ou** la session NextAuth par cookies
  (web). Le Bearer est examiné en premier, et un Bearer invalide fait échouer la requête plutôt que
  de retomber silencieusement sur la session cookie.
- `withApiErrorHandling` relaie telles quelles les exceptions de contrôle de Next
  (`DYNAMIC_SERVER_USAGE`, `NEXT_REDIRECT`) : les intercepter casserait le rendu.

Les routes historiques (`/api/user/*`, `/api/weather`, `/api/garden/[id]/advice`,
`/api/identify-plant`) restent en place pour le web et gardent leur format de réponse
(`{ error: string }`) — ne pas les confondre avec l'API v1.

### Authentification mobile (jetons)

Le web garde sa session NextAuth par cookies. Le mobile utilise des jetons, servis par
`/api/v1/auth/*` et implémentés dans `lib/auth/tokens.ts` + `lib/services/auth.service.ts` :

| | Access token | Refresh token |
|---|---|---|
| Nature | JWT signé HS256 (`jose`) | 256 bits d'aléa, opaque |
| Durée | 15 min | 60 jours |
| Stockage serveur | aucun | empreinte SHA-256 uniquement |
| Clé | `JWT_SECRET`, **distinct** de `AUTH_SECRET` | — |

- **Rotation** : chaque `/refresh` révoque le jeton présenté et en émet un nouveau, dans une seule
  transaction.
- **Détection de rejeu** : présenter un jeton déjà révoqué révoque *toutes* les sessions de
  l'utilisateur. C'est le comportement attendu, pas un bug — un jeton rejoué signale une fuite.
- `logout` est idempotent et ne demande pas d'access token valide : une déconnexion ne doit jamais
  échouer côté client.
- Les messages d'erreur ne distinguent jamais « compte inconnu » de « mot de passe faux », ni
  « jeton expiré » de « signature invalide ».

> ⚠️ Le rate limiting (`lib/api/rate-limit.ts`) est **en mémoire**, donc partiel sur Vercel où
> chaque instance a la sienne. Il freine le bourrage naïf ; un verrou partagé (Upstash Redis ou la
> couche Vercel) reste à mettre en place avant l'ouverture publique.

### Migrations Prisma — procédure imposée

La base contient une table `documents` en **pgvector** (type `vector(1024)`, index `ivfflat`) que
Prisma ne sait pas représenter. `prisma migrate dev` échoue donc sur sa base fantôme.

**Ne pas utiliser `prisma migrate dev`.** Générer la migration par différence, puis l'appliquer :

```bash
# 1. modifier schema.prisma, puis générer le SQL (aucune base fantôme requise)
pnpm exec prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<horodatage>_<nom>/migration.sql
# 2. relire le SQL — vérifier l'absence de DROP inattendu — puis appliquer
pnpm exec prisma migrate deploy
```

`DIRECT_URL` doit pointer sur le **pooler en mode session** (port 5432) : l'hôte direct
`db.<ref>.supabase.co` n'a qu'un enregistrement IPv6 et reste injoignable depuis un réseau IPv4.

L'historique antérieur (migrations SQLite, scripts SQL manuels) est archivé dans `prisma/legacy/`.

### IA & APIs externes

- **Identification de plantes** : Gemini 2.5 Flash via `app/api/identify-plant/` (clé `GEMINI_API_KEY`).
- **Diagnostic & advice engine** : Server Actions dans `app/actions/advice.actions.ts`, `lib/recommendation/`.
- **Météo** : Open-Meteo (intégré dans `dashboard/meteo`).

### Routing principal

| Route | Description |
|-------|-------------|
| `/` | Homepage (sections marketing) |
| `/fonctionnalites`, `/pro`, `/tarifs`, `/blog` | Pages marketing |
| `/login`, `/register` | Auth (custom pages) |
| `/dashboard/plantes` | Catalogue perso + fiches plantes |
| `/dashboard/catalogue` | Encyclopédie de plantes |
| `/dashboard/jardin` | Canvas du jardin (Konva) |
| `/dashboard/calendrier` | Calendrier + alertes météo |
| `/dashboard/meteo` | Météo locale |
| `/dashboard/identifier` | Identification photo (Gemini) |
| `/dashboard/parametres` | Profil + adresse autocomplete |
