'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'
import { GardenPaletteItem } from './GardenPaletteItem'

interface GardenPaletteSectionProps {
  title: string
  items: PaletteItem[]
  defaultOpen?: boolean
}

/** Minuscule + sans accents, pour une recherche tolérante. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function GardenPaletteSection({
  title,
  items,
  defaultOpen = true,
}: GardenPaletteSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return items
    return items.filter(item => normalize(item.label).includes(q))
  }, [items, query])

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
        <div className="flex flex-col gap-2 p-2">
          {/* Champ de recherche */}
          <div className="relative">
            <Search
              size={11}
              aria-hidden
              className="absolute left-2 top-1/2 -translate-y-1/2 text-forest/40 pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher…"
              aria-label={`Rechercher dans ${title.toLowerCase()}`}
              className="w-full rounded-md border border-forest/15 bg-white pl-6 pr-2 py-1 font-raleway text-[11px] text-forest placeholder:text-forest/40 focus:outline-none focus:ring-1 focus:ring-lime"
            />
          </div>

          {/* Résultats */}
          {filtered.length === 0 ? (
            <p className="font-raleway text-[10px] text-forest/40 px-1 py-2 text-center">
              Aucun résultat
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {filtered.map(item => (
                <GardenPaletteItem key={`${item.type}-${item.label}`} item={item} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
