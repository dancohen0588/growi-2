'use client'

import { cn } from '@/lib/utils'
import { PALETTE_CATALOG } from '@/lib/garden/palette'
import { GardenPaletteSection } from './GardenPaletteSection'

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
      {Object.entries(PALETTE_CATALOG).map(([title, items], i) => (
        <GardenPaletteSection
          key={title}
          title={title}
          items={items}
          defaultOpen={i === 0}
        />
      ))}
    </aside>
  )
}
