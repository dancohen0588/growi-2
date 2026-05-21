'use client'

import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'
import { resolveDrawKind, getThumbUrl } from '@/lib/garden/illustration'

interface GardenPaletteItemProps {
  item: PaletteItem
}

export function GardenPaletteItem({ item }: GardenPaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}-${item.label}`,
    data: item,
  })

  // Rendu v2 : vignette illustrée générée par le moteur, pour tous les types.
  const thumb = useMemo(
    () =>
      getThumbUrl(
        resolveDrawKind({
          type:     item.type,
          emoji:    item.emoji,
          category: item.catalogCategory,
          name:     item.label,
        }),
      ),
    [item.type, item.emoji, item.catalogCategory, item.label],
  )

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={item.label}
      aria-label={`Glisser ${item.label} sur le canvas`}
      className={cn(
        'flex flex-col items-center gap-0.5 bg-sand border border-border rounded-lg p-2 cursor-grab select-none',
        'hover:border-lime hover:bg-[#f0fae0] transition-all duration-150',
        isDragging && 'opacity-50 cursor-grabbing',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumb} alt="" aria-hidden draggable={false} className="w-8 h-8 object-contain" />
      <span className="text-[10px] font-semibold text-forest leading-tight text-center">{item.label}</span>
    </div>
  )
}
