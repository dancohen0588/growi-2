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

export interface CatalogPaletteItem {
  id:               string
  commonName:       string
  scientificName:   string
  emoji:            string | null
  imageUrl:         string | null
  category:         string
  wateringFreqDays: number
  sunExposure:      string
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
        category !== 'all' ? { category } : {},
        query.trim()
          ? {
              OR: [
                { commonName:     { contains: query, mode: 'insensitive' } },
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
