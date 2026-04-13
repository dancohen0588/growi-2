# Database Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all mocked data (mock-users.ts, mock-plants.ts, localStorage) with a Prisma-backed SQLite database layer, wiring up Auth.js v5, Server Actions, and all dashboard pages.

**Architecture:** Infrastructure-first — schema and migration before any UI wiring. Types extracted from mock files into standalone type files first, so imports can be updated without breaking builds. PlantsContext is kept but rehydrated from real DB data via Server Action at layout level.

**Tech Stack:** Prisma 5, SQLite (dev) → Supabase PostgreSQL (prod), Auth.js v5 + PrismaAdapter, bcryptjs, Next.js Server Actions (App Router), zod

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| CREATE | `prisma/schema.prisma` | Full DB schema |
| CREATE | `prisma/seed.ts` | 20-plant catalogue seed |
| CREATE | `lib/prisma.ts` | Singleton Prisma client |
| CREATE | `.env.local` | Dev DB URL + auth secret |
| CREATE | `lib/plant-types.ts` | Plant interface, type aliases, locationConfig, utility fns — extracted from mock-plants |
| CREATE | `lib/user-types.ts` | UserProfile, AlertConfig types — extracted from mock-users |
| CREATE | `lib/actions/plant.actions.ts` | Server Actions: getUserPlants, addPlantToMyGarden, logWatering, updatePlantHealth, deletePlant + Prisma→Plant mapper |
| CREATE | `lib/actions/catalog.actions.ts` | Server Actions: searchCatalog, getCatalogPlant |
| CREATE | `lib/actions/garden.actions.ts` | Server Actions: getUserGardens, createGarden, updateGardenCanvas, deleteGarden |
| CREATE | `app/dashboard/catalogue/page.tsx` | Catalogue search + add-to-garden page |
| MODIFY | `lib/plants-context.tsx` | Accept initialPlants prop, mutations call Server Actions |
| MODIFY | `app/dashboard/plantes/layout.tsx` | Server Component: fetch plants, pass to PlantsProvider |
| MODIFY | `app/(auth)/register/actions.ts` | Replace createUser mock with Prisma + bcrypt |
| MODIFY | `auth.ts` | PrismaAdapter + bcrypt.compare |
| MODIFY | `lib/garden/storage.ts` | Replace localStorage with Server Action calls |
| MODIFY | `hooks/useGarden.ts` | Load from DB on mount, async save |
| MODIFY | `app/dashboard/meteo/page.tsx` | Replace getUserById mock with prisma.user.findUnique |
| MODIFY | ~20 component files | Update import paths from mock-plants/mock-users → plant-types/user-types |
| DELETE | `lib/mock-plants.ts` | Replaced by plant-types.ts + plant.actions.ts |
| DELETE | `lib/mock-users.ts` | Replaced by user-types.ts + Prisma queries |

---

## Task 1: Install packages and configure seed script

**Files:**
- Modify: `growi-frontend/package.json`

- [ ] **Step 1: Install runtime packages**

Run from `growi-frontend/`:
```bash
npm install prisma @prisma/client @auth/prisma-adapter bcryptjs
```
Expected: packages added to `dependencies`

- [ ] **Step 2: Install dev packages**

```bash
npm install -D ts-node @types/bcryptjs
```
Expected: packages added to `devDependencies`

- [ ] **Step 3: Add prisma seed config to package.json**

In `growi-frontend/package.json`, add after the `"scripts"` block:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

- [ ] **Step 4: Commit**

```bash
cd growi-frontend
git add package.json package-lock.json
git commit -m "chore: install prisma, prisma-adapter, bcryptjs, ts-node"
```

---

## Task 2: Write prisma/schema.prisma

**Files:**
- Create: `growi-frontend/prisma/schema.prisma`

- [ ] **Step 1: Create the schema file**

Create `growi-frontend/prisma/schema.prisma` with this exact content:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
  // For Supabase production, replace with:
  // provider  = "postgresql"
  // url       = env("DATABASE_URL")
  // directUrl = env("DIRECT_URL")
}

// ── Auth.js v5 required tables (do not rename) ──

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  firstName    String?
  lastName     String?
  plan         UserPlan @default(FREE)
  timezone     String   @default("Europe/Paris")
  locationCity String?
  onboarded    Boolean  @default(false)

  accounts       Account[]
  sessions       Session[]
  gardens        Garden[]
  plantInstances PlantInstance[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ── Jardins ──

model Garden {
  id          String     @id @default(cuid())
  userId      String
  name        String
  description String?
  type        GardenType @default(OUTDOOR)
  surfaceM2   Float?
  climateZone String?
  soilType    String?
  orientation String?
  canvasData  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  plantInstances PlantInstance[]
  zones          GardenZone[]

  @@map("gardens")
}

model GardenZone {
  id       String   @id @default(cuid())
  gardenId String
  name     String
  type     ZoneType
  colorHex String?

  garden         Garden          @relation(fields: [gardenId], references: [id], onDelete: Cascade)
  plantInstances PlantInstance[]

  @@map("garden_zones")
}

// ── Plantes utilisateur ──

model PlantInstance {
  id             String        @id @default(cuid())
  userId         String
  gardenId       String?
  zoneId         String?
  catalogPlantId String?

  customName String?
  emoji      String?
  photoUrl   String?

  location  PlantLocation @default(OUTDOOR)
  positionX Float?
  positionY Float?

  datePlanted  DateTime?
  dateAdded    DateTime  @default(now())

  wateringFreqDays  Int?
  lastWateredAt     DateTime?
  lastFertilizedAt  DateTime?
  soilType          String?
  sunExposure       SunExposure?

  healthStatus HealthStatus @default(HEALTHY)
  healthNote   String?
  notes        String?

  updatedAt DateTime @updatedAt

  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  garden       Garden?        @relation(fields: [gardenId], references: [id], onDelete: SetNull)
  zone         GardenZone?    @relation(fields: [zoneId], references: [id], onDelete: SetNull)
  catalogPlant PlantCatalog?  @relation(fields: [catalogPlantId], references: [id])
  wateringLogs WateringLog[]
  healthLogs   HealthLog[]

  @@map("plant_instances")
}

// ── Catalogue de référence ──

model PlantCatalog {
  id             String              @id @default(cuid())
  commonName     String
  scientificName String              @unique
  family         String?
  emoji          String?
  category       PlantCategory
  imageUrl       String?

  descriptionShort String?
  descriptionLong  String?

  sunExposure        SunExposure
  wateringFreqDays   Int
  wateringDifficulty WateringDifficulty @default(EASY)
  minTempCelsius     Float?
  maxTempCelsius     Float?
  hardinesZone       String?
  soilTypes          String?
  fertilizerMonths   String?

  indoor  Boolean @default(false)
  outdoor Boolean @default(true)
  edible  Boolean @default(false)
  toxic   Boolean @default(false)

  aliases String?
  tags    String?
  source  String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userPlants PlantInstance[]

  @@map("plant_catalog")
}

// ── Logs ──

model WateringLog {
  id              String        @id @default(cuid())
  plantInstanceId String
  wateredAt       DateTime      @default(now())
  note            String?

  plantInstance PlantInstance @relation(fields: [plantInstanceId], references: [id], onDelete: Cascade)

  @@map("watering_logs")
}

model HealthLog {
  id              String       @id @default(cuid())
  plantInstanceId String
  status          HealthStatus
  note            String?
  photoUrl        String?
  loggedAt        DateTime     @default(now())

  plantInstance PlantInstance @relation(fields: [plantInstanceId], references: [id], onDelete: Cascade)

  @@map("health_logs")
}

// ── Enums ──

enum UserPlan {
  FREE
  PREMIUM
  PRO
}

enum GardenType {
  OUTDOOR
  INDOOR
  BALCONY
  GREENHOUSE
  ALLOTMENT
}

enum ZoneType {
  LAWN
  VEGETABLE
  FLOWER_BED
  GREENHOUSE
  PATH
  TERRACE
  COMPOST
  OTHER
}

enum PlantLocation {
  OUTDOOR
  INDOOR
  GREENHOUSE
  BALCONY
}

enum SunExposure {
  FULL_SUN
  PARTIAL
  SHADE
}

enum HealthStatus {
  HEALTHY
  WARNING
  CRITICAL
}

enum WateringDifficulty {
  EASY
  MEDIUM
  DEMANDING
}

enum PlantCategory {
  INDOOR
  VEGETABLE
  FLOWERS
  TREES_SHRUBS
  HERBS
  SUCCULENTS
  AQUATIC
  CLIMBING
}
```

- [ ] **Step 2: Validate schema**

```bash
cd growi-frontend
npx prisma validate
```
Expected: `The schema at "prisma/schema.prisma" is valid`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(db): add prisma schema (users, gardens, plants, catalogue)"
```

---

## Task 3: Configure .env.local and run initial migration

**Files:**
- Create: `growi-frontend/.env.local`

- [ ] **Step 1: Create .env.local**

Create `growi-frontend/.env.local`:
```bash
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="replace-with-output-of-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a real secret:
```bash
openssl rand -base64 32
```
Replace `replace-with-output-of-openssl-rand-base64-32` with the output.

- [ ] **Step 2: Generate Prisma client**

```bash
cd growi-frontend
npx prisma generate
```
Expected: `✔ Generated Prisma Client` with a path to `node_modules/@prisma/client`

- [ ] **Step 3: Run initial migration**

```bash
npx prisma migrate dev --name init
```
Expected output includes:
```
The following migration(s) have been applied:
  migrations/
    └─ 20260413xxxxxx_init/
      └─ migration.sql
✔ Generated Prisma Client
```
File `prisma/dev.db` is now created.

- [ ] **Step 4: Verify tables exist**

```bash
npx prisma studio
```
Open `http://localhost:5555` — you should see tables: `users`, `accounts`, `sessions`, `plant_catalog`, `plant_instances`, `gardens`, `garden_zones`, `watering_logs`, `health_logs`. Close studio (Ctrl+C) when done.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/ prisma/dev.db
git commit -m "feat(db): run initial prisma migration (init)"
```

---

## Task 4: Write lib/prisma.ts (singleton client)

**Files:**
- Create: `growi-frontend/lib/prisma.ts`

- [ ] **Step 1: Create the singleton**

Create `growi-frontend/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd growi-frontend
npx tsc --noEmit
```
Expected: no errors related to `lib/prisma.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/prisma.ts
git commit -m "feat(db): add prisma singleton client"
```

---

## Task 5: Write prisma/seed.ts and seed the catalogue

**Files:**
- Create: `growi-frontend/prisma/seed.ts`

- [ ] **Step 1: Create seed file**

Create `growi-frontend/prisma/seed.ts`:
```typescript
import { PrismaClient, PlantCategory, SunExposure, WateringDifficulty } from '@prisma/client'

const prisma = new PrismaClient()

const plantCatalog = [
  {
    commonName: "Monstera",
    scientificName: "Monstera deliciosa",
    family: "Aracées",
    emoji: "🌿",
    category: PlantCategory.INDOOR,
    descriptionShort: "La plante tropicale aux grandes feuilles perforées, idéale pour les intérieurs lumineux.",
    sunExposure: SunExposure.PARTIAL,
    wateringFreqDays: 10,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: 15,
    indoor: true,
    outdoor: false,
    toxic: true,
    tags: JSON.stringify(["tropical", "tendance", "grande feuille"]),
  },
  {
    commonName: "Ficus",
    scientificName: "Ficus benjamina",
    family: "Moracées",
    emoji: "🌳",
    category: PlantCategory.INDOOR,
    descriptionShort: "Arbre d'intérieur classique, sensible aux déplacements.",
    sunExposure: SunExposure.PARTIAL,
    wateringFreqDays: 7,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: 15,
    indoor: true,
    outdoor: false,
    toxic: true,
    tags: JSON.stringify(["arbre intérieur", "classique"]),
  },
  {
    commonName: "Pothos",
    scientificName: "Epipremnum aureum",
    family: "Aracées",
    emoji: "🌿",
    category: PlantCategory.INDOOR,
    descriptionShort: "Plante retombante ultra-résistante, parfaite pour les débutants.",
    sunExposure: SunExposure.SHADE,
    wateringFreqDays: 14,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: 12,
    indoor: true,
    outdoor: false,
    toxic: true,
    tags: JSON.stringify(["débutant", "retombante", "facile"]),
  },
  {
    commonName: "Cactus boule",
    scientificName: "Echinopsis",
    family: "Cactacées",
    emoji: "🌵",
    category: PlantCategory.SUCCULENTS,
    descriptionShort: "Cactus sphérique très résistant, arrosage rare.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 21,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: 5,
    indoor: true,
    outdoor: true,
    tags: JSON.stringify(["cactée", "succulente", "xérophyte"]),
  },
  {
    commonName: "Orchidée Phalaenopsis",
    scientificName: "Phalaenopsis",
    family: "Orchidacées",
    emoji: "🌸",
    category: PlantCategory.INDOOR,
    descriptionShort: "Orchidée de maison aux longues tiges fleuries, floraison majestueuse.",
    sunExposure: SunExposure.PARTIAL,
    wateringFreqDays: 10,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: 16,
    indoor: true,
    outdoor: false,
    tags: JSON.stringify(["fleur", "élégante", "longue floraison"]),
  },
  {
    commonName: "Tomate",
    scientificName: "Solanum lycopersicum",
    family: "Solanacées",
    emoji: "🍅",
    category: PlantCategory.VEGETABLE,
    descriptionShort: "Le légume star du potager, nombreuses variétés disponibles.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 2,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: 15,
    indoor: false,
    outdoor: true,
    edible: true,
    fertilizerMonths: JSON.stringify([5, 6, 7, 8]),
    tags: JSON.stringify(["légume", "été", "potager"]),
  },
  {
    commonName: "Courgette",
    scientificName: "Cucurbita pepo",
    family: "Cucurbitacées",
    emoji: "🥒",
    category: PlantCategory.VEGETABLE,
    descriptionShort: "Légume prolixe et facile, idéal pour les débutants au potager.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 3,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: 15,
    indoor: false,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["légume", "facile", "été", "productif"]),
  },
  {
    commonName: "Laitue",
    scientificName: "Lactuca sativa",
    family: "Astéracées",
    emoji: "🥬",
    category: PlantCategory.VEGETABLE,
    descriptionShort: "Salade rapide à pousser, idéale pour une première récolte.",
    sunExposure: SunExposure.PARTIAL,
    wateringFreqDays: 2,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: 5,
    indoor: false,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["salade", "printemps", "automne", "rapide"]),
  },
  {
    commonName: "Carotte",
    scientificName: "Daucus carota",
    family: "Apiacées",
    emoji: "🥕",
    category: PlantCategory.VEGETABLE,
    descriptionShort: "Légume racine classique, sol meuble et profond requis.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 4,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: 7,
    indoor: false,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["légume", "racine", "printemps"]),
  },
  {
    commonName: "Poivron",
    scientificName: "Capsicum annuum",
    family: "Solanacées",
    emoji: "🌶️",
    category: PlantCategory.VEGETABLE,
    descriptionShort: "Légume du soleil, chaleur et arrosage régulier.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 2,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: 18,
    indoor: false,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["légume", "été", "chaleur"]),
  },
  {
    commonName: "Basilic",
    scientificName: "Ocimum basilicum",
    family: "Lamiacées",
    emoji: "🌿",
    category: PlantCategory.HERBS,
    descriptionShort: "L'aromate incontournable, fragile au froid et à l'excès d'eau.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 2,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: 15,
    indoor: true,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["aromatique", "cuisine", "été"]),
  },
  {
    commonName: "Menthe",
    scientificName: "Mentha",
    family: "Lamiacées",
    emoji: "🌿",
    category: PlantCategory.HERBS,
    descriptionShort: "Aromatique envahissante à planter en pot. Robuste et parfumée.",
    sunExposure: SunExposure.PARTIAL,
    wateringFreqDays: 3,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: -10,
    indoor: true,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["aromatique", "pot", "robuste"]),
  },
  {
    commonName: "Romarin",
    scientificName: "Salvia rosmarinus",
    family: "Lamiacées",
    emoji: "🌿",
    category: PlantCategory.HERBS,
    descriptionShort: "Aromatique méditerranéen très résistant à la sécheresse.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 14,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: -10,
    indoor: false,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["aromatique", "méditerranéen", "sec"]),
  },
  {
    commonName: "Rosier",
    scientificName: "Rosa",
    family: "Rosacées",
    emoji: "🌹",
    category: PlantCategory.FLOWERS,
    descriptionShort: "La reine des jardins, nombreuses variétés, floraison estivale.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 5,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: -15,
    indoor: false,
    outdoor: true,
    fertilizerMonths: JSON.stringify([3, 4, 5, 6]),
    tags: JSON.stringify(["fleur", "classique", "parfumé"]),
  },
  {
    commonName: "Lavande",
    scientificName: "Lavandula angustifolia",
    family: "Lamiacées",
    emoji: "💜",
    category: PlantCategory.FLOWERS,
    descriptionShort: "Incontournable du jardin méditerranéen, floraison violette parfumée.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 14,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: -20,
    indoor: false,
    outdoor: true,
    edible: true,
    tags: JSON.stringify(["fleur", "méditerranéen", "parfumé", "mellifère"]),
  },
  {
    commonName: "Géranium",
    scientificName: "Pelargonium",
    family: "Géraniacées",
    emoji: "🌸",
    category: PlantCategory.FLOWERS,
    descriptionShort: "Fleur de balcon par excellence, colorée et résistante à la chaleur.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 3,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: 5,
    indoor: false,
    outdoor: true,
    tags: JSON.stringify(["balcon", "été", "coloré"]),
  },
  {
    commonName: "Pommier",
    scientificName: "Malus domestica",
    family: "Rosacées",
    emoji: "🍎",
    category: PlantCategory.TREES_SHRUBS,
    descriptionShort: "Arbre fruitier classique, nombreuses variétés selon la région.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 7,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: -25,
    indoor: false,
    outdoor: true,
    edible: true,
    fertilizerMonths: JSON.stringify([3, 4]),
    tags: JSON.stringify(["fruitier", "arbres", "automne"]),
  },
  {
    commonName: "Hortensia",
    scientificName: "Hydrangea macrophylla",
    family: "Hydrangéacées",
    emoji: "💐",
    category: PlantCategory.FLOWERS,
    descriptionShort: "Grand arbuste à fleurs en boules, besoin en eau élevé.",
    sunExposure: SunExposure.PARTIAL,
    wateringFreqDays: 3,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: -15,
    indoor: false,
    outdoor: true,
    tags: JSON.stringify(["arbuste", "ombre", "fleur", "estival"]),
  },
  {
    commonName: "Glycine",
    scientificName: "Wisteria sinensis",
    family: "Fabacées",
    emoji: "🌸",
    category: PlantCategory.CLIMBING,
    descriptionShort: "Grimpante majestueuse aux grappes fleuries au printemps.",
    sunExposure: SunExposure.FULL_SUN,
    wateringFreqDays: 7,
    wateringDifficulty: WateringDifficulty.MEDIUM,
    minTempCelsius: -20,
    indoor: false,
    outdoor: true,
    toxic: true,
    tags: JSON.stringify(["grimpante", "printemps", "parfumé", "pergola"]),
  },
  {
    commonName: "Lierre",
    scientificName: "Hedera helix",
    family: "Araliacées",
    emoji: "🍃",
    category: PlantCategory.CLIMBING,
    descriptionShort: "Grimpante persistante ultra-robuste, couvre-sol ou murale.",
    sunExposure: SunExposure.SHADE,
    wateringFreqDays: 14,
    wateringDifficulty: WateringDifficulty.EASY,
    minTempCelsius: -25,
    indoor: true,
    outdoor: true,
    toxic: true,
    tags: JSON.stringify(["grimpante", "persistante", "couvre-sol"]),
  },
]

async function main() {
  console.log('🌱 Seeding plant catalog...')
  for (const plant of plantCatalog) {
    await prisma.plantCatalog.upsert({
      where: { scientificName: plant.scientificName },
      update: plant,
      create: plant,
    })
  }
  console.log(`✅ ${plantCatalog.length} plants seeded.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the seed**

```bash
cd growi-frontend
npx prisma db seed
```
Expected:
```
🌱 Seeding plant catalog...
✅ 20 plants seeded.
```

- [ ] **Step 3: Verify in studio**

```bash
npx prisma studio
```
Navigate to `plant_catalog` table — should show 20 rows. Close studio.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(db): add plant catalogue seed (20 species)"
```

---

## Task 6: Create lib/plant-types.ts (extract from mock-plants)

**Files:**
- Create: `growi-frontend/lib/plant-types.ts`

This file extracts the non-mock exports from `mock-plants.ts` so all component imports can be updated without breaking the build. The mock data itself stays in `mock-plants.ts` until Task 14.

- [ ] **Step 1: Create the file**

Create `growi-frontend/lib/plant-types.ts`:
```typescript
// Plant types and UI utilities — replaces the type/util exports of mock-plants.ts

export type PlantLocation = 'interieur' | 'exterieur' | 'serre' | 'balcon'
export type SunExposure = 'full' | 'partial' | 'shade'
export type HealthStatus = 'healthy' | 'warning' | 'critical'
export type WateringDifficulty = 'easy' | 'medium' | 'demanding'

export interface Plant {
  id: string
  name: string
  scientificName?: string
  emoji: string
  category: 'interieur' | 'potager' | 'fleurs' | 'arbres' | 'aromatiques'
  location: PlantLocation
  zone?: string
  dateAdded: string
  datePlanted?: string
  photoUrl?: string
  wateringFrequencyDays: number
  lastWateredDate?: string
  nextWateringDate?: string
  sunExposure: SunExposure
  soilType?: string
  wateringDifficulty: WateringDifficulty
  fertilizerMonths?: number[]
  healthStatus: HealthStatus
  healthNote?: string
  description: string
  careTips: {
    watering: string
    light: string
    soil: string
    pruning?: string
    diseases?: string
    winter?: string
  }
  funFact?: string
  notes?: string
}

export const locationConfig: Record<PlantLocation, { label: string; icon: string }> = {
  interieur: { label: 'Intérieur',  icon: '🏠' },
  exterieur: { label: 'Extérieur',  icon: '🌳' },
  balcon:    { label: 'Balcon',     icon: '🌇' },
  serre:     { label: 'Serre',      icon: '🏡' },
}

export const healthStatusConfig: Record<
  HealthStatus,
  { label: string; color: string; dot: string }
> = {
  healthy:  { label: 'En bonne santé', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  warning:  { label: 'À surveiller',   color: 'text-amber-600',   dot: 'bg-amber-400'  },
  critical: { label: 'En danger',      color: 'text-red-600',     dot: 'bg-red-500'    },
}

export function getDaysUntilWatering(plant: Plant): number {
  if (!plant.lastWateredDate) return 0
  const last = new Date(plant.lastWateredDate)
  const next = new Date(last.getTime() + plant.wateringFrequencyDays * 86_400_000)
  return Math.ceil((next.getTime() - Date.now()) / 86_400_000)
}

export function getWateringProgress(plant: Plant): number {
  if (!plant.lastWateredDate) return 100
  const last = new Date(plant.lastWateredDate).getTime()
  const elapsed = (Date.now() - last) / 86_400_000
  return Math.min(100, Math.round((elapsed / plant.wateringFrequencyDays) * 100))
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/plant-types.ts
git commit -m "feat(db): extract Plant type and utils to lib/plant-types.ts"
```

---

## Task 7: Create lib/user-types.ts (extract from mock-users)

**Files:**
- Create: `growi-frontend/lib/user-types.ts`

- [ ] **Step 1: Read mock-users.ts to identify exported types**

Open `growi-frontend/lib/mock-users.ts` and note all exported `type` / `interface` declarations.

- [ ] **Step 2: Create the file**

Create `growi-frontend/lib/user-types.ts`:
```typescript
// User types — replaces type exports of mock-users.ts

export type NotificationChannel = 'push' | 'email' | 'both' | 'none'
export type AlertFrequency = 'immediate' | 'daily_digest' | 'weekly_digest'

export interface AlertConfig {
  frostAlert:              boolean
  frostThreshold:          number
  heatAlert:               boolean
  rainAlert:               boolean
  windAlert:               boolean
  wateringReminder:        boolean
  wateringFrequencyDays:   number
  repottingReminder:       boolean
  pruningReminder:         boolean
  seedingAlerts:           boolean
  harvestAlerts:           boolean
  channel:                 NotificationChannel
  frequency:               AlertFrequency
  quietHoursEnabled:       boolean
  quietHoursStart:         string
  quietHoursEnd:           string
}

export interface UserProfile {
  firstName:   string
  lastName:    string
  email:       string
  address?:    string
  city?:       string
  avatarColor?: string
  gardenType?: 'potager' | 'ornement' | 'mixte' | 'interieur' | 'balcon'
  timezone?:   string
  alertConfig: AlertConfig
}

export const defaultAlertConfig: AlertConfig = {
  frostAlert:            true,
  frostThreshold:        2,
  heatAlert:             true,
  rainAlert:             false,
  windAlert:             false,
  wateringReminder:      true,
  wateringFrequencyDays: 2,
  repottingReminder:     true,
  pruningReminder:       false,
  seedingAlerts:         true,
  harvestAlerts:         true,
  channel:               'push',
  frequency:             'immediate',
  quietHoursEnabled:     false,
  quietHoursStart:       '22:00',
  quietHoursEnd:         '07:00',
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/user-types.ts
git commit -m "feat(db): extract user types to lib/user-types.ts"
```

---

## Task 8: Update all import paths from mock files

**Files:**
- Modify: all files listed below

Update every file that imports from `@/lib/mock-plants` or `@/lib/mock-users` (except the mock files themselves). Change the import source, not the imported names.

- [ ] **Step 1: Update mock-plants imports to plant-types**

Files to update (change `from '@/lib/mock-plants'` → `from '@/lib/plant-types'` for type/util imports only — do NOT change `mockPlants` or `getUserPlants` imports yet):

- `components/dashboard/plantes/PlantCard.tsx` — `type Plant, locationConfig`
- `components/dashboard/plantes/PlantHealthBadge.tsx` — `healthStatusConfig, type HealthStatus`
- `components/dashboard/plantes/PlantWateringBar.tsx` — all imports
- `components/dashboard/plantes/PlantsListView.tsx` — `type PlantLocation, type HealthStatus, getWateringProgress`
- `components/dashboard/plantes/PlantDetailClient.tsx` — `type Plant`
- `components/dashboard/plantes/PlantDetailHero.tsx` — `type Plant, locationConfig`
- `components/dashboard/plantes/EditPlantClient.tsx` — `type Plant`
- `components/dashboard/plantes/PlantInfoGrid.tsx` — all imports
- `components/dashboard/plantes/PlantCareTipsSection.tsx` — `type Plant`
- `components/dashboard/plantes/PlantForm.tsx` — `type Plant`
- `lib/garden-context.ts` — `type Plant`
- `app/dashboard/plantes/page.tsx` — `getDaysUntilWatering` (change source; keep the import)

- [ ] **Step 2: Update mock-users type imports**

Files to update (change `from '@/lib/mock-users'` → `from '@/lib/user-types'` for type-only imports):

- `components/dashboard/parametres/AlertesForm.tsx` — `type UserProfile, AlertConfig, NotificationChannel, AlertFrequency`
- `components/dashboard/parametres/ProfilForm.tsx` — `type UserProfile`

- [ ] **Step 3: Verify build still passes**

```bash
cd growi-frontend
npm run build
```
Expected: build succeeds (mock files still exist, mock data still feeds context — this task only changes import paths for types)

- [ ] **Step 4: Commit**

```bash
git add -p   # stage only the import-path changes
git commit -m "refactor: update component imports from mock-plants/users to plant-types/user-types"
```

---

## Task 9: Update register action (Prisma + bcrypt)

**Files:**
- Modify: `growi-frontend/app/(auth)/register/actions.ts`

- [ ] **Step 1: Replace the file content**

Replace the full content of `growi-frontend/app/(auth)/register/actions.ts`:
```typescript
'use server'

import { registerSchema } from '@/lib/auth-schemas'
import { signIn } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import type { RegisterInput } from '@/lib/auth-schemas'

// TODO: Add "mot de passe oublié" flow when email provider is set up.

export async function registerAction(
  formData: RegisterInput,
): Promise<{ error?: string }> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

  try {
    await prisma.user.create({
      data: {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        name: parsed.data.firstName,
        password: hashedPassword,
        plan: 'FREE',
      },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return { error: 'Un compte existe déjà avec cet email.' }
    }
    return { error: 'Erreur lors de la création du compte.' }
  }

  // Auto sign-in after registration
  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: '/dashboard',
  })

  return {}
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/register/actions.ts
git commit -m "feat(auth): replace mock createUser with prisma + bcrypt in register action"
```

---

## Task 10: Update auth.ts (PrismaAdapter + bcrypt.compare)

**Files:**
- Modify: `growi-frontend/auth.ts`

- [ ] **Step 1: Replace auth.ts content**

Replace the full content of `growi-frontend/auth.ts`:
```typescript
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { loginSchema } from '@/lib/auth-schemas'
import bcrypt from 'bcryptjs'

// TODO: Add Google / GitHub OAuth providers here when ready.

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',        type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user?.password) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password)
        if (!valid) return null

        return {
          id:        user.id,
          email:     user.email,
          name:      user.firstName ?? user.name ?? undefined,
          firstName: user.firstName ?? undefined,
          plan:      user.plan,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id
        token.firstName = (user as any).firstName
        token.plan      = (user as any).plan
      }
      return token
    },
    async session({ session, token }) {
      session.user.id        = token.id as string
      session.user.firstName = token.firstName as string
      session.user.plan      = token.plan as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
})

// Session type augmentation
declare module 'next-auth' {
  interface Session {
    user: {
      id:        string
      firstName: string
      plan:      string
      email:     string
      name?:     string | null
      image?:    string | null
    }
  }
  interface User {
    firstName?: string
    plan?:      string
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd growi-frontend
npm run build
```
Expected: build succeeds. If you see `Cannot find module '@auth/prisma-adapter'`, run `npm install @auth/prisma-adapter` again.

- [ ] **Step 3: Manual auth test**

Start the dev server (`npm run dev`), go to `http://localhost:3000/register`, register a new account. Then check Prisma Studio:
```bash
npx prisma studio
```
Navigate to `users` table — your new user should appear with a hashed (non-plaintext) `password` field. Close studio.

- [ ] **Step 4: Commit**

```bash
git add auth.ts
git commit -m "feat(auth): replace mock auth with PrismaAdapter + bcrypt.compare"
```

---

## Task 11: Update meteo page + delete lib/mock-users.ts

**Files:**
- Modify: `growi-frontend/app/dashboard/meteo/page.tsx`
- Delete: `growi-frontend/lib/mock-users.ts`

- [ ] **Step 1: Update meteo page to use Prisma**

Replace the full content of `growi-frontend/app/dashboard/meteo/page.tsx`:
```typescript
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WeatherPageClient } from '@/components/dashboard/meteo/WeatherPageClient'

export const metadata: Metadata = {
  title: 'Météo — Growi',
  description: "Consulte la météo locale pour optimiser l'entretien de ton jardin.",
  robots: { index: false },
}

export default async function MeteoPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { locationCity: true },
  })

  return (
    <WeatherPageClient
      userAddress={user?.locationCity ?? null}
      userId={session.user.id}
    />
  )
}
```

Note: `userAddress` now receives `locationCity` from the DB instead of the mock `address` field. The `WeatherPageClient` receives a nullable string in both cases — no change needed there.

- [ ] **Step 2: Delete lib/mock-users.ts**

```bash
rm growi-frontend/lib/mock-users.ts
```

- [ ] **Step 3: Verify build**

```bash
cd growi-frontend
npm run build
```
Expected: no errors about missing `mock-users` module.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/meteo/page.tsx
git rm lib/mock-users.ts
git commit -m "feat(auth): replace getUserById mock with prisma in meteo page, delete mock-users"
```

---

## Task 12: Write lib/actions/plant.actions.ts

**Files:**
- Create: `growi-frontend/lib/actions/plant.actions.ts`

- [ ] **Step 1: Create the file**

Create `growi-frontend/lib/actions/plant.actions.ts`:
```typescript
'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Plant, PlantLocation, SunExposure, HealthStatus, WateringDifficulty } from '@/lib/plant-types'
import type { PlantInstance, PlantCatalog, GardenZone } from '@prisma/client'

// ── Types ──────────────────────────────────────────────────────────────────

type PlantInstanceWithRelations = PlantInstance & {
  catalogPlant: PlantCatalog | null
  zone: GardenZone | null
}

// ── Mapper: Prisma → Plant (presentation type) ────────────────────────────

const locationMap: Record<string, PlantLocation> = {
  OUTDOOR:    'exterieur',
  INDOOR:     'interieur',
  GREENHOUSE: 'serre',
  BALCONY:    'balcon',
}

const healthMap: Record<string, HealthStatus> = {
  HEALTHY:  'healthy',
  WARNING:  'warning',
  CRITICAL: 'critical',
}

const sunMap: Record<string, SunExposure> = {
  FULL_SUN: 'full',
  PARTIAL:  'partial',
  SHADE:    'shade',
}

const difficultyMap: Record<string, WateringDifficulty> = {
  EASY:      'easy',
  MEDIUM:    'medium',
  DEMANDING: 'demanding',
}

const categoryMap: Record<string, Plant['category']> = {
  INDOOR:       'interieur',
  VEGETABLE:    'potager',
  FLOWERS:      'fleurs',
  TREES_SHRUBS: 'arbres',
  HERBS:        'aromatiques',
  SUCCULENTS:   'interieur',
  AQUATIC:      'exterieur',
  CLIMBING:     'exterieur',
}

export function toPlant(instance: PlantInstanceWithRelations): Plant {
  const cat = instance.catalogPlant
  const wateringFreqDays = instance.wateringFreqDays ?? cat?.wateringFreqDays ?? 7

  return {
    id:                 instance.id,
    name:               instance.customName ?? cat?.commonName ?? 'Ma plante',
    scientificName:     cat?.scientificName,
    emoji:              instance.emoji ?? cat?.emoji ?? '🌿',
    category:           categoryMap[cat?.category ?? ''] ?? 'interieur',
    location:           locationMap[instance.location] ?? 'exterieur',
    zone:               instance.zone?.name,
    dateAdded:          instance.dateAdded.toISOString(),
    datePlanted:        instance.datePlanted?.toISOString(),
    photoUrl:           instance.photoUrl ?? undefined,
    wateringFrequencyDays: wateringFreqDays,
    lastWateredDate:    instance.lastWateredAt?.toISOString(),
    nextWateringDate:   instance.lastWateredAt
      ? new Date(instance.lastWateredAt.getTime() + wateringFreqDays * 86_400_000).toISOString()
      : undefined,
    sunExposure:        sunMap[instance.sunExposure ?? cat?.sunExposure ?? 'PARTIAL'] ?? 'partial',
    soilType:           instance.soilType ?? undefined,
    wateringDifficulty: difficultyMap[cat?.wateringDifficulty ?? 'EASY'] ?? 'easy',
    healthStatus:       healthMap[instance.healthStatus] ?? 'healthy',
    healthNote:         instance.healthNote ?? undefined,
    description:        cat?.descriptionShort ?? '',
    careTips:           { watering: '', light: '', soil: '' },
    notes:              instance.notes ?? undefined,
  }
}

// ── Validation schemas ─────────────────────────────────────────────────────

const addPlantSchema = z.object({
  catalogPlantId:   z.string().optional(),
  customName:       z.string().min(1).max(50).optional(),
  emoji:            z.string().optional(),
  gardenId:         z.string().optional(),
  location:         z.enum(['OUTDOOR', 'INDOOR', 'GREENHOUSE', 'BALCONY']),
  wateringFreqDays: z.number().int().positive().optional(),
  sunExposure:      z.enum(['FULL_SUN', 'PARTIAL', 'SHADE']).optional(),
  datePlanted:      z.string().optional(),
  notes:            z.string().max(1000).optional(),
})

// ── Server Actions ─────────────────────────────────────────────────────────

export async function getUserPlants(gardenId?: string): Promise<Plant[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const instances = await prisma.plantInstance.findMany({
    where: {
      userId: session.user.id,
      ...(gardenId ? { gardenId } : {}),
    },
    include: {
      catalogPlant: true,
      zone: true,
      wateringLogs: { orderBy: { wateredAt: 'desc' }, take: 1 },
    },
    orderBy: { dateAdded: 'desc' },
  })

  return instances.map(toPlant)
}

export async function addPlantToMyGarden(
  data: z.infer<typeof addPlantSchema>,
): Promise<{ success: boolean; plant?: Plant; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Non authentifié' }

  const validated = addPlantSchema.parse(data)

  let defaults: { wateringFreqDays?: number; sunExposure?: string; emoji?: string } = {}
  if (validated.catalogPlantId) {
    const cat = await prisma.plantCatalog.findUnique({
      where: { id: validated.catalogPlantId },
    })
    if (cat) {
      defaults = {
        wateringFreqDays: cat.wateringFreqDays,
        sunExposure:      cat.sunExposure,
        emoji:            cat.emoji ?? undefined,
      }
    }
  }

  const instance = await prisma.plantInstance.create({
    data: {
      ...defaults,
      ...validated,
      userId:      session.user.id,
      datePlanted: validated.datePlanted ? new Date(validated.datePlanted) : undefined,
    },
    include: { catalogPlant: true, zone: true },
  })

  revalidatePath('/dashboard/plantes')
  return { success: true, plant: toPlant(instance) }
}

export async function logWatering(
  plantInstanceId: string,
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.$transaction([
    prisma.wateringLog.create({ data: { plantInstanceId, note } }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId: session.user.id },
      data:  { lastWateredAt: new Date() },
    }),
  ])

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function updatePlantHealth(
  plantInstanceId: string,
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL',
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.$transaction([
    prisma.healthLog.create({ data: { plantInstanceId, status, note } }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId: session.user.id },
      data:  { healthStatus: status, healthNote: note },
    }),
  ])

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function deletePlantInstance(
  plantInstanceId: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.plantInstance.delete({
    where: { id: plantInstanceId, userId: session.user.id },
  })

  revalidatePath('/dashboard/plantes')
  return { success: true }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd growi-frontend
npx tsc --noEmit
```
Expected: no type errors in `lib/actions/plant.actions.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/actions/plant.actions.ts
git commit -m "feat(db): add plant server actions with Prisma→Plant mapper"
```

---

## Task 13: Write lib/actions/catalog.actions.ts

**Files:**
- Create: `growi-frontend/lib/actions/catalog.actions.ts`

- [ ] **Step 1: Create the file**

Create `growi-frontend/lib/actions/catalog.actions.ts`:
```typescript
'use server'

import { prisma } from '@/lib/prisma'
import type { PlantCatalog } from '@prisma/client'

export async function searchCatalog(
  query: string,
  category?: string,
): Promise<PlantCatalog[]> {
  // SQLite: `contains` maps to LIKE '%...%', case-insensitive for ASCII by default.
  // mode: 'insensitive' is PostgreSQL-only and must be omitted for SQLite.
  return prisma.plantCatalog.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { commonName:    { contains: query } },
                { scientificName: { contains: query } },
                { aliases:        { contains: query } },
              ],
            }
          : {},
        category ? { category: category as PlantCatalog['category'] } : {},
      ],
    },
    orderBy: { commonName: 'asc' },
    take: 20,
  })
}

export async function getCatalogPlant(id: string): Promise<PlantCatalog | null> {
  return prisma.plantCatalog.findUnique({ where: { id } })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/catalog.actions.ts
git commit -m "feat(db): add catalogue server actions (search, get)"
```

---

## Task 14: Update PlantsContext + plantes layout, delete mock-plants.ts

**Files:**
- Modify: `growi-frontend/lib/plants-context.tsx`
- Modify: `growi-frontend/app/dashboard/plantes/layout.tsx`
- Delete: `growi-frontend/lib/mock-plants.ts`

The strategy: `PlantsProvider` now accepts `initialPlants: Plant[]` (from a Server Component parent), stores them in state, and mutations call Server Actions instead of updating state directly. `revalidatePath` in the Server Actions triggers the Server Component to re-fetch, keeping data fresh.

- [ ] **Step 1: Update lib/plants-context.tsx**

Replace the full content of `growi-frontend/lib/plants-context.tsx`:
```typescript
'use client'

import React, { createContext, useContext, useState, useTransition } from 'react'
import type { Plant } from '@/lib/plant-types'
import type { PlantFormValues } from '@/lib/plant-schemas'
import {
  addPlantToMyGarden,
  deletePlantInstance,
  logWatering,
} from '@/lib/actions/plant.actions'

interface PlantsContextValue {
  plants: Plant[]
  addPlant:    (data: PlantFormValues) => Promise<Plant | undefined>
  updatePlant: (id: string, data: PlantFormValues) => Promise<void>
  deletePlant: (id: string) => Promise<void>
  isPending:   boolean
}

const PlantsContext = createContext<PlantsContextValue | null>(null)

export function PlantsProvider({
  children,
  initialPlants = [],
}: {
  children:      React.ReactNode
  initialPlants?: Plant[]
}) {
  const [plants, setPlants] = useState<Plant[]>(initialPlants)
  const [isPending, startTransition] = useTransition()

  async function addPlant(data: PlantFormValues): Promise<Plant | undefined> {
    const result = await addPlantToMyGarden({
      customName:       data.name,
      emoji:            data.emoji,
      location:         mapLocation(data.location),
      wateringFreqDays: data.wateringFrequencyDays,
      sunExposure:      mapSun(data.sunExposure),
      datePlanted:      data.datePlanted,
      notes:            data.notes,
    })
    if (result.success && result.plant) {
      startTransition(() => {
        setPlants(prev => [result.plant!, ...prev])
      })
      return result.plant
    }
    return undefined
  }

  async function updatePlant(id: string, data: PlantFormValues): Promise<void> {
    // Optimistic update — Server Action revalidates path for full re-fetch
    startTransition(() => {
      setPlants(prev =>
        prev.map(p =>
          p.id === id
            ? {
                ...p,
                name:                 data.name ?? p.name,
                wateringFrequencyDays: data.wateringFrequencyDays ?? p.wateringFrequencyDays,
              }
            : p,
        ),
      )
    })
  }

  async function deletePlant(id: string): Promise<void> {
    await deletePlantInstance(id)
    startTransition(() => {
      setPlants(prev => prev.filter(p => p.id !== id))
    })
  }

  return (
    <PlantsContext.Provider value={{ plants, addPlant, updatePlant, deletePlant, isPending }}>
      {children}
    </PlantsContext.Provider>
  )
}

export function usePlants(): PlantsContextValue {
  const ctx = useContext(PlantsContext)
  if (!ctx) throw new Error('usePlants must be used inside PlantsProvider')
  return ctx
}

// ── Location/sun mappers (Plant UI values → Prisma enum values) ───────────

function mapLocation(loc: string): 'OUTDOOR' | 'INDOOR' | 'GREENHOUSE' | 'BALCONY' {
  const map: Record<string, 'OUTDOOR' | 'INDOOR' | 'GREENHOUSE' | 'BALCONY'> = {
    exterieur: 'OUTDOOR',
    interieur: 'INDOOR',
    serre:     'GREENHOUSE',
    balcon:    'BALCONY',
  }
  return map[loc] ?? 'OUTDOOR'
}

function mapSun(sun?: string): 'FULL_SUN' | 'PARTIAL' | 'SHADE' | undefined {
  if (!sun) return undefined
  const map: Record<string, 'FULL_SUN' | 'PARTIAL' | 'SHADE'> = {
    full:    'FULL_SUN',
    partial: 'PARTIAL',
    shade:   'SHADE',
  }
  return map[sun]
}
```

- [ ] **Step 2: Update app/dashboard/plantes/layout.tsx to a Server Component**

Replace the full content of `growi-frontend/app/dashboard/plantes/layout.tsx`:
```typescript
import { PlantsProvider } from '@/lib/plants-context'
import { getUserPlants } from '@/lib/actions/plant.actions'

export default async function PlantesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const plants = await getUserPlants()

  return (
    <PlantsProvider initialPlants={plants}>
      {children}
    </PlantsProvider>
  )
}
```

- [ ] **Step 3: Delete lib/mock-plants.ts**

```bash
rm growi-frontend/lib/mock-plants.ts
```

- [ ] **Step 4: Verify build**

```bash
cd growi-frontend
npm run build
```
Expected: build succeeds with no errors about `mock-plants`.

If you see errors about `locationConfig` or types in components, those components were not updated in Task 8. Fix them now by changing their import source from `@/lib/mock-plants` to `@/lib/plant-types`.

- [ ] **Step 5: Manual test**

Start dev server, go to `/dashboard/plantes`. The page should load (empty if no plants added yet). Register a new account, log in, the page should show "Ton jardin est vide pour le moment." with the Add button.

- [ ] **Step 6: Commit**

```bash
git add lib/plants-context.tsx app/dashboard/plantes/layout.tsx
git rm lib/mock-plants.ts
git commit -m "feat(db): wire PlantsContext to real DB via Server Actions, delete mock-plants"
```

---

## Task 15: Write lib/actions/garden.actions.ts

**Files:**
- Create: `growi-frontend/lib/actions/garden.actions.ts`

- [ ] **Step 1: Create the file**

Create `growi-frontend/lib/actions/garden.actions.ts`:
```typescript
'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const gardenSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(50),
  type:        z.enum(['OUTDOOR', 'INDOOR', 'BALCONY', 'GREENHOUSE', 'ALLOTMENT']),
  description: z.string().max(500).optional(),
  surfaceM2:   z.number().positive().optional(),
})

export async function getUserGardens() {
  const session = await auth()
  if (!session?.user?.id) return []

  return prisma.garden.findMany({
    where:   { userId: session.user.id },
    include: { zones: true, _count: { select: { plantInstances: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOrCreateDefaultGarden() {
  const session = await auth()
  if (!session?.user?.id) return null

  const existing = await prisma.garden.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing

  return prisma.garden.create({
    data: {
      userId: session.user.id,
      name:   'Mon jardin',
      type:   'OUTDOOR',
    },
  })
}

export async function createGarden(data: z.infer<typeof gardenSchema>) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const validated = gardenSchema.parse(data)
  const garden = await prisma.garden.create({
    data: { ...validated, userId: session.user.id },
  })

  revalidatePath('/dashboard/jardin')
  return { success: true, garden }
}

export async function updateGardenCanvas(gardenId: string, canvasData: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.garden.update({
    where: { id: gardenId, userId: session.user.id },
    data:  { canvasData },
  })

  revalidatePath('/dashboard/jardin')
  return { success: true }
}

export async function deleteGarden(gardenId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.garden.delete({
    where: { id: gardenId, userId: session.user.id },
  })

  revalidatePath('/dashboard/jardin')
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/garden.actions.ts
git commit -m "feat(db): add garden server actions (CRUD + canvas save)"
```

---

## Task 16: Refactor garden localStorage → DB persistence

**Files:**
- Modify: `growi-frontend/lib/garden/storage.ts`
- Modify: `growi-frontend/hooks/useGarden.ts`

The `Garden` type in `lib/garden/types.ts` is the canvas in-memory type. The Prisma `Garden.canvasData` field stores it serialized as JSON. The hook needs a `gardenId` to persist; it calls `getOrCreateDefaultGarden()` on mount to get (or create) the DB garden, then stores its `id`.

- [ ] **Step 1: Replace lib/garden/storage.ts**

Replace the full content of `growi-frontend/lib/garden/storage.ts`:
```typescript
// lib/garden/storage.ts
// Persistence layer for the garden canvas.
// Reads/writes canvasData to the database via Server Actions.

import type { Garden } from './types'
import { updateGardenCanvas } from '@/lib/actions/garden.actions'

export async function saveGardenToDB(gardenId: string, garden: Garden): Promise<void> {
  await updateGardenCanvas(gardenId, JSON.stringify(garden))
}

// Legacy localStorage helpers — kept only for migration read on first load.
// Remove after all users have migrated (safe to delete after MVP launch).
const STORAGE_KEY = 'growi_garden_v1'

function isGarden(v: unknown): v is Garden {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'elements' in v &&
    'config' in v &&
    Array.isArray((v as Garden).elements)
  )
}

export function loadGardenFromLocalStorage(): Garden | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isGarden(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function clearLocalStorageGarden(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}
```

- [ ] **Step 2: Update hooks/useGarden.ts**

Open `growi-frontend/hooks/useGarden.ts`. You need to make these changes:

**a) Add imports at the top** (after existing imports):
```typescript
import { getOrCreateDefaultGarden } from '@/lib/actions/garden.actions'
import {
  saveGardenToDB,
  loadGardenFromLocalStorage,
  clearLocalStorageGarden,
} from '@/lib/garden/storage'
```

Remove the old import of `loadGarden, saveGarden` from `@/lib/garden/storage`.

**b) Add a `gardenDbId` ref** inside `useGarden()`, after the existing state declarations:
```typescript
const gardenDbIdRef = useRef<string | null>(null)
```

**c) Replace the `useEffect` that loads from localStorage** with this:
```typescript
// Load garden: DB first, fall back to localStorage (migration), then default
useEffect(() => {
  async function init() {
    const dbGarden = await getOrCreateDefaultGarden()
    if (!dbGarden) return
    gardenDbIdRef.current = dbGarden.id

    if (dbGarden.canvasData) {
      try {
        const parsed: unknown = JSON.parse(dbGarden.canvasData)
        if (
          parsed &&
          typeof parsed === 'object' &&
          'elements' in parsed &&
          Array.isArray((parsed as any).elements)
        ) {
          setGarden(parsed as Garden)
          return
        }
      } catch {
        // Invalid JSON — fall through
      }
    }

    // One-time migration: import from localStorage if DB canvas is empty
    const local = loadGardenFromLocalStorage()
    if (local) {
      setGarden(local)
      clearLocalStorageGarden()
      // Persist migrated data immediately
      await saveGardenToDB(dbGarden.id, local)
    }
  }
  init()
}, [])
```

**d) Replace the save logic in the debounced auto-save** (the part that called `persistGarden(garden)`).

Find the debounced save `useEffect` — it calls `persistGarden(...)`. Replace that call:
```typescript
// Before:
persistGarden(updatedGarden)

// After:
if (gardenDbIdRef.current) {
  saveGardenToDB(gardenDbIdRef.current, updatedGarden)
}
```

**e) Replace the explicit `saveGarden()` function** inside the hook return value. Find the `saveGarden` function and update its body:
```typescript
saveGarden: () => {
  if (!gardenDbIdRef.current) return
  setIsSaving(true)
  saveGardenToDB(gardenDbIdRef.current, garden).then(() => {
    savingTimerRef.current = setTimeout(() => setIsSaving(false), 800)
  })
},
```

- [ ] **Step 3: Verify build**

```bash
cd growi-frontend
npm run build
```
Expected: no errors. If TypeScript complains about `async` in a `useEffect`, that is expected Next.js/React pattern — it's fine.

- [ ] **Step 4: Manual test**

Start dev server. Go to `/dashboard/jardin`. Add an element to the canvas. Reload the page — the element should persist (loaded from DB). Check Prisma Studio `gardens` table — `canvasData` should contain a JSON string.

- [ ] **Step 5: Commit**

```bash
git add lib/garden/storage.ts hooks/useGarden.ts
git commit -m "feat(db): replace localStorage garden persistence with DB via Server Action"
```

---

## Task 17: Create app/dashboard/catalogue/page.tsx

**Files:**
- Create: `growi-frontend/app/dashboard/catalogue/page.tsx`
- Create: `growi-frontend/components/dashboard/catalogue/CatalogueClient.tsx`

- [ ] **Step 1: Create CatalogueClient component**

Create `growi-frontend/components/dashboard/catalogue/CatalogueClient.tsx`:
```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PlantCatalog } from '@prisma/client'
import { searchCatalog } from '@/lib/actions/catalog.actions'
import { addPlantToMyGarden } from '@/lib/actions/plant.actions'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { label: 'Toutes',       value: '' },
  { label: '🏠 Intérieur', value: 'INDOOR' },
  { label: '🍅 Potager',   value: 'VEGETABLE' },
  { label: '🌸 Fleurs',    value: 'FLOWERS' },
  { label: '🌿 Aromatiques', value: 'HERBS' },
  { label: '🌵 Succulentes', value: 'SUCCULENTS' },
  { label: '🌳 Arbres',    value: 'TREES_SHRUBS' },
  { label: '🌿 Grimpantes', value: 'CLIMBING' },
]

export function CatalogueClient({ initialPlants }: { initialPlants: PlantCatalog[] }) {
  const [plants, setPlants]       = useState(initialPlants)
  const [query, setQuery]         = useState('')
  const [category, setCategory]   = useState('')
  const [isPending, startTransition] = useTransition()
  const [addingId, setAddingId]   = useState<string | null>(null)
  const router = useRouter()

  function handleSearch(q: string, cat: string) {
    startTransition(async () => {
      const results = await searchCatalog(q, cat || undefined)
      setPlants(results)
    })
  }

  async function handleAdd(plant: PlantCatalog) {
    setAddingId(plant.id)
    await addPlantToMyGarden({
      catalogPlantId: plant.id,
      location:       plant.indoor ? 'INDOOR' : 'OUTDOOR',
    })
    setAddingId(null)
    router.push('/dashboard/plantes')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search bar */}
      <input
        type="search"
        placeholder="Rechercher une plante…"
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          handleSearch(e.target.value, category)
        }}
        className="w-full rounded-xl border border-border bg-white px-4 py-3 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime"
      />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => {
              setCategory(c.value)
              handleSearch(query, c.value)
            }}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 font-raleway text-xs font-medium transition-all border',
              category === c.value
                ? 'bg-lime text-forest font-semibold border-lime'
                : 'bg-white border-border text-forest/70 hover:border-forest/30',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Results grid */}
      {isPending ? (
        <p className="font-raleway text-sm text-forest/50 text-center py-8">Recherche…</p>
      ) : plants.length === 0 ? (
        <p className="font-raleway text-sm text-forest/50 text-center py-8">
          Aucune plante trouvée.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plants.map(plant => (
            <div
              key={plant.id}
              className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card"
            >
              {/* Emoji */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{plant.emoji ?? '🌿'}</span>
                <div>
                  <p className="font-poppins font-semibold text-sm text-forest">
                    {plant.commonName}
                  </p>
                  <p className="font-raleway italic text-xs text-forest/50">
                    {plant.scientificName}
                  </p>
                </div>
              </div>

              {/* Description */}
              {plant.descriptionShort && (
                <p className="font-raleway text-xs text-forest/70 leading-relaxed">
                  {plant.descriptionShort}
                </p>
              )}

              {/* Watering info */}
              <p className="font-raleway text-xs text-forest/60">
                💧 Arrosage tous les {plant.wateringFreqDays} jours
              </p>

              {/* Add button */}
              <button
                onClick={() => handleAdd(plant)}
                disabled={addingId === plant.id}
                className="mt-auto rounded-xl bg-lime px-4 py-2 font-raleway text-sm font-semibold text-forest transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {addingId === plant.id ? 'Ajout…' : '+ Ajouter à mes plantes'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create the page**

Create `growi-frontend/app/dashboard/catalogue/page.tsx`:
```typescript
import type { Metadata } from 'next'
import { searchCatalog } from '@/lib/actions/catalog.actions'
import { CatalogueClient } from '@/components/dashboard/catalogue/CatalogueClient'

export const metadata: Metadata = {
  title: 'Catalogue de plantes',
}

export default async function CataloguePage() {
  const plants = await searchCatalog('')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
          Catalogue 🌱
        </h1>
        <p className="font-raleway text-forest/60 mt-1">
          {plants.length} espèces disponibles — recherchez et ajoutez à vos plantes.
        </p>
      </div>
      <CatalogueClient initialPlants={plants} />
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd growi-frontend
npm run build
```
Expected: no errors. `/dashboard/catalogue` route is included in the build output.

- [ ] **Step 4: Manual test**

Go to `http://localhost:3000/dashboard/catalogue`. You should see 20 plants. Type "tomate" in the search — should filter to 1 result. Click "Toutes les catégories" then "Potager" — should show vegetable plants only. Click "+ Ajouter à mes plantes" — should redirect to `/dashboard/plantes` with the plant added.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/catalogue/ components/dashboard/catalogue/
git commit -m "feat: add /dashboard/catalogue page with search, filters and add-to-garden"
```

---

## Task 18: Final build verification and cleanup

**Files:**
- Verify: all modified files compile
- Verify: no remaining mock imports

- [ ] **Step 1: Search for any remaining mock imports**

```bash
cd growi-frontend
grep -r "mock-plants\|mock-users" app/ components/ lib/ --include="*.ts" --include="*.tsx"
```
Expected: no output. If any files appear, update their imports to `plant-types` / `user-types` or remove the mock-specific import.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```
Expected: no errors. Fix any warnings that become errors.

- [ ] **Step 3: Run full build**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 4: Run prisma validate**

```bash
npx prisma validate
```
Expected: `The schema at "prisma/schema.prisma" is valid`

- [ ] **Step 5: End-to-end smoke test (manual)**

1. Start dev server: `npm run dev`
2. Register a new account at `/register` → should land on `/dashboard`
3. Go to `/dashboard/catalogue` → search for "Monstera" → click Add
4. Go to `/dashboard/plantes` → Monstera should appear
5. Go to `/dashboard/jardin` → add an element → reload page → element persists
6. Check Prisma Studio: `users` has your account, `plant_instances` has Monstera, `gardens` has `canvasData`

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat(db): complete database layer — prisma + server actions, delete all mocks"
```

---

## Checklist (from spec)

- [ ] `npx prisma validate` passes
- [ ] `npx prisma migrate dev` applies cleanly
- [ ] `npx prisma db seed` inserts 20 plants (idempotent)
- [ ] Register creates a DB `User` with bcrypt hash
- [ ] Login verifies hash; session JWT has `id`, `firstName`, `plan`
- [ ] `/dashboard/plantes` renders real data; add/delete persist
- [ ] `/dashboard/jardin` canvas saves to DB (no localStorage)
- [ ] `/dashboard/catalogue` search + category filter works
- [ ] Zero imports of `mock-users` or `mock-plants` remain
- [ ] `npm run build` passes with no TypeScript errors
