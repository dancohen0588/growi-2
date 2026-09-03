'use client'

import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'
import { resolveDrawKind, getThumbUrl } from '@/lib/garden/illustration'
import { usePaletteAdd } from './palette-add-context'

interface GardenPaletteItemProps {
  item: PaletteItem
}

export function GardenPaletteItem({ item }: GardenPaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}-${item.label}`,
    data: item,
  })
  const addToCenter = usePaletteAdd()

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
      onDoubleClick={addToCenter ? () => addToCenter(item) : undefined}
      title={`${item.label} — glisse-le sur le plan, ou double-clique pour le poser au centre`}
      aria-label={`Glisser ${item.label} sur le canvas, ou double-cliquer pour le poser au centre de la vue`}
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
