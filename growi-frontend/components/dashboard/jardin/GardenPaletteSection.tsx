'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'
import { GardenPaletteItem } from './GardenPaletteItem'

interface GardenPaletteSectionProps {
  title: string
  items: PaletteItem[]
  defaultOpen?: boolean
}

export function GardenPaletteSection({ title, items, defaultOpen = true }: GardenPaletteSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-forest/10 last:border-0">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-sand transition-colors"
        aria-expanded={open}
      >
        <span className="font-poppins font-semibold text-[11px] text-forest uppercase tracking-wide">
          {title}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn('text-forest/40 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-1.5 p-2">
          {items.map(item => (
            <GardenPaletteItem key={`${item.type}-${item.label}`} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
