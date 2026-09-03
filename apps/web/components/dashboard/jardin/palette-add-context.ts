'use client'

import { createContext, useContext } from 'react'
import type { PaletteItem } from '@/lib/garden/palette'

/**
 * Ajout d'un élément par double-clic depuis la palette.
 *
 * Passe par un contexte plutôt que par des props : la palette est un arbre de
 * quatre composants, rendu à deux endroits (colonne de gauche et feuille
 * mobile), et seul le canevas sait où se trouve la vue.
 */
const PaletteAddContext = createContext<((item: PaletteItem) => void) | null>(null)

export const PaletteAddProvider = PaletteAddContext.Provider

export function usePaletteAdd(): ((item: PaletteItem) => void) | null {
  return useContext(PaletteAddContext)
}
