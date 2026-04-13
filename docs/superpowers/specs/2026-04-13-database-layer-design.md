# Growi — Database Layer Design
**Date:** 2026-04-13
**Stack:** Prisma · SQLite (dev) → Supabase PostgreSQL (prod) · Auth.js v5 · Next.js Server Actions

---

## Goal

Replace all mocked data (`lib/mock-users.ts`, `lib/mock-plants.ts`, `localStorage`) with a persistent Prisma-backed database layer. Scope: user accounts, gardens, user plant instances, and a seeded plant catalogue.

---

## Phasing (Infrastructure-first, A)

### Phase 1 — Infrastructure
**Files:** `prisma/schema.prisma`, `prisma/seed.ts`, `lib/prisma.ts`, `.env.local`
**Packages:** `prisma`, `@prisma/client`, `@auth/prisma-adapter`, `bcryptjs`, `ts-node`

1. Install packages
2. Write full Prisma schema (see Data Model below)
3. Configure `.env.local` with `DATABASE_URL="file:./prisma/dev.db"`
4. Run `npx prisma migrate dev --name init`
5. Run `npx prisma db seed` (20 plants seeded)
6. Write `lib/prisma.ts` singleton (dev hot-reload safe)

**Exit condition:** `npx prisma studio` shows the 20 seeded plants with correct fields.

---

### Phase 2 — Auth Migration
**Files:** `auth.ts`, `app/(auth)/register/actions.ts` (modified), `lib/mock-users.ts` (deleted)

1. Update `app/(auth)/register/actions.ts` — replace `createUser` mock call with `prisma.user.create` + bcrypt hash (cost 12)
2. Update `auth.ts` — add `PrismaAdapter`, replace `verifyUser` mock with `prisma.user.findUnique` + `bcrypt.compare`
3. Session JWT still carries `id`, `firstName`, `plan`
4. Delete `lib/mock-users.ts`

**Exit condition:** Register creates a DB row; login verifies bcrypt hash; session has correct shape.

---

### Phase 3 — Vertical Slice: Plantes
**Files:** `lib/actions/plant.actions.ts`, `lib/actions/catalog.actions.ts`, `app/dashboard/plantes/page.tsx`

1. Write `lib/actions/plant.actions.ts` — `getUserPlants`, `addPlantToMyGarden`, `logWatering`, `updatePlantHealth`, `deletePlant`
2. Write `lib/actions/catalog.actions.ts` — `searchCatalog`, `getCatalogPlant`
3. Refactor `app/dashboard/plantes/page.tsx` as a Server Component calling `getUserPlants()`
4. Wire add/water/delete actions in the existing plant UI components

**Exit condition:** `/dashboard/plantes` shows real DB plants; all mutations persist across page reload.

---

### Phase 4 — Expand + Clean Up
**Files:** `lib/actions/garden.actions.ts`, `app/dashboard/jardin/`, `app/dashboard/catalogue/`, `lib/mock-plants.ts` (deleted)

1. Write `lib/actions/garden.actions.ts` — `getUserGardens`, `createGarden`, `updateGardenCanvas`, `deleteGarden`
2. Refactor `lib/garden/storage.ts` and `hooks/useGarden.ts` — replace `localStorage` canvas persistence with `updateGardenCanvas` Server Action
3. Create `/dashboard/catalogue/page.tsx` — search bar + category tabs + result grid + "Add to my plants" CTA
4. Wire dashboard home counts via Prisma `_count`
5. Delete `lib/mock-plants.ts`

**Exit condition:** Canvas state persists in DB; catalogue search works; zero mock imports remain.

---

## Data Model

### Auth.js tables (managed by PrismaAdapter — do not modify)
`User`, `Account`, `Session`, `VerificationToken`

### Extended User fields
`firstName`, `lastName`, `plan (FREE|PREMIUM|PRO)`, `timezone`, `locationCity`, `onboarded`

### Garden
Belongs to one `User`. Fields: `name`, `type (OUTDOOR|INDOOR|BALCONY|GREENHOUSE|ALLOTMENT)`, `surfaceM2`, `climateZone`, `soilType`, `orientation`, `canvasData (JSON string)`.
Has many `GardenZone` and `PlantInstance`.

### GardenZone
Belongs to one `Garden`. Fields: `name`, `type (LAWN|VEGETABLE|FLOWER_BED|...)`, `colorHex`.

### PlantInstance
Belongs to `User`, optionally to `Garden` and `GardenZone`. References `PlantCatalog` (optional — custom plants have no catalogue entry). Catalogue defaults (watering, sun, emoji) are copied at creation and can be overridden per-instance. Has many `WateringLog` and `HealthLog`.

### PlantCatalog
Public reference table. Seeded with 20 species (MVP). Fields: `commonName`, `scientificName`, `category`, `sunExposure`, `wateringFreqDays`, `wateringDifficulty`, `minTempCelsius`, `indoor`, `outdoor`, `edible`, `toxic`, `tags (JSON string)`.
Unique key: `scientificName` (enables idempotent seed via `upsert`).

### WateringLog / HealthLog
Append-only event logs per `PlantInstance`. Used for watering history and health status history.

### JSON-as-string fields
`tags`, `soilTypes`, `fertilizerMonths`, `aliases`, `canvasData` — all stored as `String?` for SQLite compatibility. Identical in PostgreSQL (no schema change needed for prod migration).

---

## Error Handling & Security

| Concern | Approach |
|---|---|
| Unauthenticated access | `auth()` check is line 1 of every mutation; throws `Error('Non authentifié')` |
| Input validation | Zod schema parsed before any Prisma call; invalid input throws `ZodError` |
| Ownership isolation | All mutations include `where: { id, userId: session.user.id }` — Prisma returns 0 rows if mismatch; action throws explicitly |
| Password storage | bcrypt, cost 12; never logged or returned in queries |
| Cache invalidation | `revalidatePath` called after every mutation |
| Photo uploads | Out of scope for MVP — `photoUrl` is a plain string (URL or null) |

---

## Environment Variables

```bash
# .env.local (dev — SQLite)
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
```

```bash
# Production (Supabase — schema.prisma provider switched to "postgresql")
DATABASE_URL="postgresql://postgres.[REF]:[PWD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres"
```

---

## Files Created / Modified / Deleted

| Action | Path |
|---|---|
| CREATE | `prisma/schema.prisma` |
| CREATE | `prisma/seed.ts` |
| CREATE | `lib/prisma.ts` |
| MODIFY | `app/(auth)/register/actions.ts` |
| CREATE | `lib/actions/plant.actions.ts` |
| CREATE | `lib/actions/catalog.actions.ts` |
| CREATE | `lib/actions/garden.actions.ts` |
| CREATE | `app/dashboard/catalogue/page.tsx` |
| MODIFY | `auth.ts` |
| MODIFY | `app/dashboard/plantes/page.tsx` |
| MODIFY | `app/dashboard/jardin/` (canvas persistence) |
| MODIFY | `package.json` (prisma seed script) |
| DELETE | `lib/mock-users.ts` |
| DELETE | `lib/mock-plants.ts` |

---

## Delivery Checklist

- [ ] `npx prisma validate` passes
- [ ] `npx prisma migrate dev` applies cleanly
- [ ] `npx prisma db seed` inserts 20 plants (idempotent)
- [ ] Register creates a DB `User` with bcrypt hash
- [ ] Login verifies hash; session JWT has `id`, `firstName`, `plan`
- [ ] `/dashboard/plantes` renders real data; add/water/delete persist
- [ ] `/dashboard/jardin` canvas saves to DB (no localStorage)
- [ ] `/dashboard/catalogue` search + category filter works
- [ ] Dashboard counts are real Prisma `_count` values
- [ ] Zero imports of `mock-users` or `mock-plants` remain
- [ ] `npm run build` passes with no TypeScript errors
