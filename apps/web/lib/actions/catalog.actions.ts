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
        // Les arbres & arbustes ont leur propre section : on les exclut ici.
        category !== 'all' ? { category } : { category: { not: 'TREES_SHRUBS' } },
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

// ── Arbres & arbustes (catégorie TREES_SHRUBS du catalogue) ────────────────

export interface CatalogTreeItem {
  id:             string
  commonName:     string
  scientificName: string
  family:         string | null
  emoji:          string | null
  imageUrl:       string | null
  treeType:       string | null
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
                { commonName:     { contains: query, mode: 'insensitive' } },
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
