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
