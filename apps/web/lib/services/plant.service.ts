/**
 * Service plantes — plantes de l'utilisateur et catalogue d'espèces.
 *
 * Les fonctions renvoient les entités Prisma brutes (avec leurs relations) :
 * la conversion vers le type de présentation du web se fait dans
 * `lib/plant-mapper.ts`, celle vers le JSON de l'API v1 dans les routes.
 */

import type {
  AddIdentifiedPlantInput,
  CreatePlantInstanceInput,
  UpdatePlantInstanceInput,
} from '@growi/shared'
import type { PlantCatalog } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { PlantInstanceWithRelations } from '@/lib/plant-mapper'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { ServiceError } from '@/lib/services/errors'

// ─── Plantes de l'utilisateur ──────────────────────────────────────────────

/** Plantes de l'utilisateur, éventuellement filtrées sur un jardin. */
export async function listPlantInstances(userId: string, gardenId?: string) {
  return prisma.plantInstance.findMany({
    where: {
      userId,
      ...(gardenId ? { gardenId } : {}),
    },
    include: { catalogPlant: true, zone: true },
    orderBy: { dateAdded: 'desc' },
  })
}

/** Une plante de l'utilisateur, ou `null`. */
export async function findPlantInstance(plantInstanceId: string, userId: string) {
  return prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    include: { catalogPlant: true, zone: true },
  })
}

/**
 * Vérifie qu'un jardin cible appartient bien à l'utilisateur.
 *
 * Indispensable dès qu'un `gardenId` vient du client : sans ce contrôle, on
 * peut déposer une plante dans le jardin de quelqu'un d'autre.
 * @throws ServiceError('NOT_FOUND')
 */
async function assertGardenBelongsToUser(gardenId: string, userId: string): Promise<void> {
  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId },
    select: { id: true },
  })
  if (!garden) throw new ServiceError('NOT_FOUND', 'Jardin introuvable')
}

/**
 * Vérifie qu'une zone cible appartient à un jardin de l'utilisateur.
 *
 * Même raisonnement : la fiche plante renvoie le nom et la couleur de sa zone,
 * donc rattacher sa plante à la zone d'un autre reviendrait à les lire.
 * @throws ServiceError('NOT_FOUND')
 */
async function assertZoneBelongsToUser(zoneId: string, userId: string): Promise<void> {
  const zone = await prisma.gardenZone.findFirst({
    where: { id: zoneId, garden: { userId } },
    select: { id: true },
  })
  if (!zone) throw new ServiceError('NOT_FOUND', 'Zone introuvable')
}

/**
 * Vérifie que la plante appartient à l'utilisateur et renvoie son jardin.
 * @throws ServiceError('NOT_FOUND')
 */
export async function assertPlantOwned(
  plantInstanceId: string,
  userId: string,
): Promise<{ gardenId: string | null }> {
  const instance = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    select: { gardenId: true },
  })
  if (!instance) throw new ServiceError('NOT_FOUND', 'Plante introuvable')
  return instance
}

/**
 * Ajoute une plante au jardin de l'utilisateur.
 *
 * Si aucun jardin n'est fourni, la plante rejoint le jardin le plus récent.
 * Les caractéristiques d'entretien manquantes sont héritées de la fiche
 * catalogue quand la plante y est reliée.
 */
export async function createPlantInstance(
  userId: string,
  input: CreatePlantInstanceInput,
): Promise<PlantInstanceWithRelations> {
  let gardenId = input.gardenId
  if (gardenId) {
    await assertGardenBelongsToUser(gardenId, userId)
  } else {
    const defaultGarden = await prisma.garden.findFirst({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    gardenId = defaultGarden?.id
  }

  let defaults: { wateringFreqDays?: number; sunExposure?: string; emoji?: string } = {}
  if (input.catalogPlantId) {
    const cat = await prisma.plantCatalog.findUnique({
      where: { id: input.catalogPlantId },
    })
    if (cat) {
      defaults = {
        wateringFreqDays: cat.wateringFreqDays,
        sunExposure: cat.sunExposure,
        emoji: cat.emoji ?? undefined,
      }
    }
  }

  const created = await prisma.plantInstance.create({
    data: {
      ...defaults,
      ...input,
      gardenId,
      userId,
      datePlanted: input.datePlanted ? new Date(input.datePlanted) : undefined,
    },
  })

  return prisma.plantInstance.findUniqueOrThrow({
    where: { id: created.id },
    include: { catalogPlant: true, zone: true },
  })
}

/**
 * Ajoute une plante issue de l'identification photo.
 *
 * Si l'espèce reconnue correspond à une fiche du catalogue (via son slug), la
 * plante y est reliée et hérite de ses valeurs par défaut ; sinon on crée une
 * plante personnalisée à partir du nom fourni par l'IA, pour ne rien perdre.
 */
export async function addIdentifiedPlant(
  userId: string,
  input: AddIdentifiedPlantInput,
): Promise<{ plantId: string }> {
  const catalogPlant = input.encyclopediaSlug
    ? await prisma.plantCatalog.findUnique({
        where: { slug: input.encyclopediaSlug },
      })
    : null

  const defaultGarden = await prisma.garden.findFirst({
    where: { userId },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })

  const location =
    catalogPlant && catalogPlant.indoor && !catalogPlant.outdoor ? 'INDOOR' : 'OUTDOOR'

  const created = await prisma.plantInstance.create({
    data: {
      userId,
      gardenId: defaultGarden?.id,
      catalogPlantId: catalogPlant?.id,
      customName: catalogPlant ? null : input.commonName,
      emoji: catalogPlant?.emoji ?? input.emoji ?? null,
      wateringFreqDays: catalogPlant?.wateringFreqDays,
      sunExposure: catalogPlant?.sunExposure,
      location,
    },
  })

  return { plantId: created.id }
}

/**
 * Met à jour une plante. Seuls les champs fournis sont modifiés.
 * @throws ServiceError('NOT_FOUND') si la plante n'est pas à l'utilisateur.
 */
export async function updatePlantInstance(
  plantInstanceId: string,
  userId: string,
  input: UpdatePlantInstanceInput,
): Promise<PlantInstanceWithRelations> {
  await assertPlantOwned(plantInstanceId, userId)

  // Le jardin et la zone visés viennent du client : ils doivent lui appartenir.
  if (input.gardenId) await assertGardenBelongsToUser(input.gardenId, userId)
  if (input.zoneId) await assertZoneBelongsToUser(input.zoneId, userId)

  const { datePlanted, ...rest } = input

  await prisma.plantInstance.update({
    where: { id: plantInstanceId, userId },
    data: {
      ...rest,
      ...(datePlanted !== undefined
        ? { datePlanted: datePlanted ? new Date(datePlanted) : null }
        : {}),
    },
  })

  return prisma.plantInstance.findUniqueOrThrow({
    where: { id: plantInstanceId },
    include: { catalogPlant: true, zone: true },
  })
}

export async function deletePlantInstance(plantInstanceId: string, userId: string) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)

  await prisma.plantInstance.delete({
    where: { id: plantInstanceId, userId },
  })

  if (gardenId) await invalidateGardenAdviceCache(gardenId)
}

// ─── Catalogue d'espèces ───────────────────────────────────────────────────

export async function searchCatalog(
  query: string,
  category?: string,
): Promise<PlantCatalog[]> {
  return prisma.plantCatalog.findMany({
    where: {
      AND: [
        query
          ? {
              OR: [
                { commonName: { contains: query, mode: 'insensitive' } },
                { scientificName: { contains: query, mode: 'insensitive' } },
                { aliases: { contains: query, mode: 'insensitive' } },
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

export interface CatalogPaletteItem {
  id: string
  commonName: string
  scientificName: string
  emoji: string | null
  imageUrl: string | null
  category: string
  wateringFreqDays: number
  sunExposure: string
}

export async function getCatalogByCategory(
  category: string,
  query: string,
  limit = 10,
  offset = 0,
): Promise<CatalogPaletteItem[]> {
  return prisma.plantCatalog.findMany({
    where: {
      AND: [
        // Les arbres & arbustes ont leur propre section : on les exclut ici.
        category !== 'all' ? { category } : { category: { not: 'TREES_SHRUBS' } },
        query.trim()
          ? {
              OR: [
                { commonName: { contains: query, mode: 'insensitive' } },
                { scientificName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
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

export interface CatalogTreeItem {
  id: string
  commonName: string
  scientificName: string
  family: string | null
  emoji: string | null
  imageUrl: string | null
  treeType: string | null
}

/** Liste paginée des arbres & arbustes, filtrable par sous-type et recherche. */
export async function getTreeCatalog(
  treeType: string,
  query: string,
  limit = 10,
  offset = 0,
): Promise<CatalogTreeItem[]> {
  return prisma.plantCatalog.findMany({
    where: {
      AND: [
        { category: 'TREES_SHRUBS' },
        treeType !== 'all' ? { treeType } : {},
        query.trim()
          ? {
              OR: [
                { commonName: { contains: query, mode: 'insensitive' } },
                { scientificName: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    select: {
      id: true, commonName: true, scientificName: true,
      family: true, emoji: true, imageUrl: true, treeType: true,
    },
    orderBy: { commonName: 'asc' },
    take: limit,
    skip: offset,
  })
}

/**
 * Emplacement par défaut d'une espèce du catalogue : intérieur seulement si
 * la fiche l'indique explicitement, extérieur sinon.
 */
export async function getCatalogDefaultLocation(
  catalogPlantId: string,
): Promise<'INDOOR' | 'OUTDOOR'> {
  const cat = await prisma.plantCatalog.findUnique({
    where: { id: catalogPlantId },
    select: { indoor: true, outdoor: true },
  })
  return cat?.indoor && !cat?.outdoor ? 'INDOOR' : 'OUTDOOR'
}

/**
 * Cherche la fiche encyclopédie correspondant à une espèce identifiée par
 * l'IA, par nom commun, nom scientifique ou alias.
 */
export async function findCatalogMatch(commonName: string, scientificName: string) {
  return prisma.plantCatalog.findFirst({
    where: {
      OR: [
        { commonName: { contains: commonName, mode: 'insensitive' } },
        { scientificName: { contains: scientificName, mode: 'insensitive' } },
        { aliases: { contains: commonName, mode: 'insensitive' } },
      ],
    },
    select: { slug: true, commonName: true, emoji: true },
  })
}
