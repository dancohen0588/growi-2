'use client'

import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { PaletteItem } from '@/lib/garden/palette'

interface GardenPaletteItemProps {
  item: PaletteItem
}

export function GardenPaletteItem({ item }: GardenPaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}-${item.label}`,
    data: item,
  })

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
      <span className="text-2xl block leading-none" aria-hidden>{item.emoji}</span>
      <span className="text-[10px] font-semibold text-forest leading-tight text-center">{item.label}</span>
    </div>
  )
}
