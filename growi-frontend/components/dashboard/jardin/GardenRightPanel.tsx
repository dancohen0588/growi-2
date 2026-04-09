'use client'
import type { GardenElement, GardenConfig } from '@/lib/garden/types'

interface GardenRightPanelProps {
  selectedElement: GardenElement | null
  onUpdateElement: (id: string, patch: Partial<GardenElement>) => void
  onDeleteElement: (id: string) => void
  config: GardenConfig
  onUpdateConfig: (patch: Partial<GardenConfig>) => void
}

export function GardenRightPanel({ selectedElement }: GardenRightPanelProps) {
  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-l border-forest/10 items-center justify-center">
      <p className="font-raleway text-xs text-forest/30 p-4 text-center">
        {selectedElement ? `${selectedElement.emoji} ${selectedElement.label}` : 'Panneau de propriétés'}
      </p>
    </aside>
  )
}
