/**
 * Sérialiseurs Prisma → JSON de l'API v1.
 *
 * Les entités de `@growi/shared` décrivent la représentation JSON : les dates
 * y sont des chaînes ISO. C'est ici que la conversion depuis les objets `Date`
 * de Prisma est faite, une bonne fois pour toutes.
 */

import type {
  CareLog,
  Garden,
  GardenWithStats,
  GardenZone,
  PlantCatalog,
  PlantInstance,
  PlantInstanceWithRelations,
} from '@growi/shared'
import type {
  CareLog as PrismaCareLog,
  Garden as PrismaGarden,
  GardenZone as PrismaGardenZone,
  PlantCatalog as PrismaPlantCatalog,
  PlantInstance as PrismaPlantInstance,
} from '@prisma/client'

const iso = (d: Date): string => d.toISOString()
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null)

// ─── Jardin ────────────────────────────────────────────────────────────────

export function serializeGardenZone(zone: PrismaGardenZone): GardenZone {
  return {
    id: zone.id,
    gardenId: zone.gardenId,
    name: zone.name,
    type: zone.type,
    colorHex: zone.colorHex,
  }
}

export function serializeGarden(garden: PrismaGarden): Garden {
  return {
    ...garden,
    createdAt: iso(garden.createdAt),
    updatedAt: iso(garden.updatedAt),
  }
}

export function serializeGardenWithStats(
  garden: PrismaGarden & {
    zones?: PrismaGardenZone[]
    _count?: { plantInstances: number }
  },
): GardenWithStats {
  const { zones, _count, ...rest } = garden
  return {
    ...serializeGarden(rest as PrismaGarden),
    ...(zones ? { zones: zones.map(serializeGardenZone) } : {}),
    ...(_count ? { plantCount: _count.plantInstances } : {}),
  }
}

// ─── Plantes ───────────────────────────────────────────────────────────────

export function serializePlantCatalog(plant: PrismaPlantCatalog): PlantCatalog {
  return {
    ...plant,
    createdAt: iso(plant.createdAt),
    updatedAt: iso(plant.updatedAt),
  }
}

export function serializePlantInstance(instance: PrismaPlantInstance): PlantInstance {
  return {
    ...instance,
    datePlanted: isoOrNull(instance.datePlanted),
    dateAdded: iso(instance.dateAdded),
    lastWateredAt: isoOrNull(instance.lastWateredAt),
    lastFertilizedAt: isoOrNull(instance.lastFertilizedAt),
    lastPrunedAt: isoOrNull(instance.lastPrunedAt),
    lastRepottedAt: isoOrNull(instance.lastRepottedAt),
    lastTreatedAt: isoOrNull(instance.lastTreatedAt),
    expectedHarvestDate: isoOrNull(instance.expectedHarvestDate),
    updatedAt: iso(instance.updatedAt),
  }
}

export function serializePlantInstanceWithRelations(
  instance: PrismaPlantInstance & {
    catalogPlant?: PrismaPlantCatalog | null
    zone?: PrismaGardenZone | null
  },
): PlantInstanceWithRelations {
  const { catalogPlant, zone, ...rest } = instance
  return {
    ...serializePlantInstance(rest as PrismaPlantInstance),
    catalogPlant: catalogPlant ? serializePlantCatalog(catalogPlant) : null,
    zone: zone ? { id: zone.id, name: zone.name, colorHex: zone.colorHex } : null,
  }
}

// ─── Journal d'entretien ───────────────────────────────────────────────────

export function serializeCareLog(log: PrismaCareLog): CareLog {
  return {
    ...log,
    // La colonne est un texte libre en base ; l'énumération vit dans le schéma.
    type: log.type as CareLog['type'],
    occurredAt: iso(log.occurredAt),
    createdAt: iso(log.createdAt),
  }
}
