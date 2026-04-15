'use server'

import { prisma } from '@/lib/prisma'
import type { PlantCatalog } from '@prisma/client'

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
                { commonName:     { contains: query, mode: 'insensitive' } },
                { scientificName: { contains: query, mode: 'insensitive' } },
                { aliases:        { contains: query, mode: 'insensitive' } },
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
