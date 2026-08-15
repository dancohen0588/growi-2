'use server'

import type { PlantCatalog } from '@prisma/client'

import * as plantService from '@/lib/services/plant.service'
import type { CatalogPaletteItem, CatalogTreeItem } from '@/lib/services/plant.service'

export type { CatalogPaletteItem, CatalogTreeItem }

export async function searchCatalog(
  query: string,
  category?: string,
): Promise<PlantCatalog[]> {
  return plantService.searchCatalog(query, category)
}

export async function getCatalogPlant(id: string): Promise<PlantCatalog | null> {
  return plantService.getCatalogPlant(id)
}

export async function getCatalogByCategory(
  category: string,
  query: string,
  limit = 10,
  offset = 0,
): Promise<CatalogPaletteItem[]> {
  return plantService.getCatalogByCategory(category, query, limit, offset)
}

/** Liste paginée des arbres & arbustes, filtrable par sous-type et recherche. */
export async function getTreeCatalog(
  treeType: string,
  query: string,
  limit = 10,
  offset = 0,
): Promise<CatalogTreeItem[]> {
  return plantService.getTreeCatalog(treeType, query, limit, offset)
}
