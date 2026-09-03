// growi-frontend/components/dashboard/jardin/GardenZoomControls.tsx
'use client'

import { Hand, Maximize, Minimize } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GardenZoomControlsProps {
  zoom: number
  onZoom: (zoom: number) => void
  /** Cadre la vue sur tout ce que porte le plan. */
  onFit: () => void
  /** Mode déplacement : le glissé déplace la vue, jamais un élément. */
  panMode: boolean
  onTogglePanMode: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
}

/**
 * Un pas multiplicatif, et non additif : de 100 % à 10 %, dix soustractions de
 * 10 points ne mènent nulle part, neuf divisions par 1,25 oui.
 */
const FACTOR = 1.25

/**
 * Un grand terrain fait facilement 60 m de côté, soit 2 400 px à l'échelle par
 * défaut : le voir entier demande de descendre bien en dessous de 40 %.
 */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 2

export function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function GardenZoomControls({
  zoom, onZoom, onFit, panMode, onTogglePanMode, fullscreen, onToggleFullscreen,
}: GardenZoomControlsProps) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center bg-white border border-border rounded-xl shadow-sm overflow-hidden select-none">
      <button
        onClick={() => onZoom(clampZoom(zoom / FACTOR))}
        disabled={zoom <= MIN_ZOOM}
        title="Zoom arrière"
        aria-label="Zoom arrière"
        className="px-3 py-1.5 font-poppins text-xs font-bold text-forest border-r border-forest/10 hover:bg-sand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>
      <span className="px-3 py-1.5 font-poppins text-xs font-semibold text-forest/60 w-14 text-center" aria-label="Niveau de zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoom(clampZoom(zoom * FACTOR))}
        disabled={zoom >= MAX_ZOOM}
        title="Zoom avant"
        aria-label="Zoom avant"
        className="px-3 py-1.5 font-poppins text-xs font-bold text-forest border-l border-r border-forest/10 hover:bg-sand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
      {/* Libellé plutôt qu'icône : à cette taille, un cadre de recadrage et un
          symbole de plein écran ne se distinguent pas. */}
      <button
        onClick={onFit}
        title="Voir tout le plan"
        aria-label="Voir tout le plan"
        className="px-2.5 py-1.5 font-raleway text-xs text-forest/70 border-r border-forest/10 hover:bg-sand hover:text-forest transition-colors"
      >
        Tout voir
      </button>
      <button
        onClick={onTogglePanMode}
        aria-pressed={panMode}
        title={panMode ? 'Revenir à l’édition' : 'Déplacer le plan sans rien bouger'}
        aria-label={panMode ? 'Revenir à l’édition' : 'Déplacer le plan sans rien bouger'}
        className={cn(
          'px-2.5 py-1.5 border-r border-forest/10 transition-colors',
          panMode ? 'bg-lime/30 text-forest' : 'text-forest/70 hover:bg-sand hover:text-forest',
        )}
      >
        <Hand size={15} aria-hidden />
      </button>
      <button
        onClick={onToggleFullscreen}
        aria-pressed={fullscreen}
        title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        aria-label={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        className="px-2.5 py-1.5 text-forest/70 hover:bg-sand hover:text-forest transition-colors"
      >
        {fullscreen ? <Minimize size={15} aria-hidden /> : <Maximize size={15} aria-hidden />}
      </button>
    </div>
  )
}
