'use client'

import { cn } from '@/lib/utils'
import { PALETTE_CATALOG } from '@/lib/garden/palette'
import { GardenPaletteSection } from './GardenPaletteSection'
import { GardenPalettePlants } from './GardenPalettePlants'

interface GardenPaletteProps {
  embedded?: boolean
}

export function GardenPalette({ embedded = false }: GardenPaletteProps) {
  return (
    <aside
      aria-label="Palette d'éléments"
      className={cn(
        'flex flex-col bg-white border-r border-forest/10 overflow-y-auto',
        !embedded && 'hidden md:flex w-48 shrink-0',
        embedded && 'w-full',
      )}
    >
      <div className="px-3 py-2 border-b border-forest/10 shrink-0">
        <p className="font-poppins font-bold text-[11px] text-forest uppercase tracking-wide">
          Éléments
        </p>
        <p className="font-raleway text-[10px] text-forest/40 mt-0.5">
          Glisse sur le canvas
        </p>
      </div>

      {/* Static sections: Structures, Zones — injected order preserved */}
      <GardenPaletteSection
        title="Structures"
        items={PALETTE_CATALOG['Structures']}
        defaultOpen
      />
      <GardenPaletteSection
        title="Zones"
        items={PALETTE_CATALOG['Zones']}
        defaultOpen={false}
      />

      {/* Dynamic catalog-backed Plants section (collapsed until first open → lazy load) */}
      <GardenPalettePlants />

      {/* Remaining static sections: Arbres, Eau & Équipements */}
      <GardenPaletteSection
        title="Arbres"
        items={PALETTE_CATALOG['Arbres']}
        defaultOpen={false}
      />
      <GardenPaletteSection
        title="Eau & Équipements"
        items={PALETTE_CATALOG['Eau & Équipements']}
        defaultOpen={false}
      />
    </aside>
  )
}
