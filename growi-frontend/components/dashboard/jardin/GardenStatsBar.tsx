// growi-frontend/components/dashboard/jardin/GardenStatsBar.tsx
import type { GardenElement } from '@/lib/garden/types'

interface GardenStatsBarProps {
  elements: GardenElement[]
}

export function GardenStatsBar({ elements }: GardenStatsBarProps) {
  const plants = elements.filter(e => e.type === 'plante').length
  const trees  = elements.filter(e => e.type === 'arbre').length
  const zones  = elements.filter(e =>
    ['pelouse', 'massif', 'potager', 'serre', 'allee', 'rocaille'].includes(e.type)
  ).length

  if (elements.length === 0) return null

  return (
    <div className="absolute bottom-14 right-3 z-10 flex items-center gap-2 bg-white border border-border rounded-lg px-2.5 py-1 text-xs font-semibold shadow-sm font-raleway text-forest/70 select-none pointer-events-none">
      <span>🌺 {plants} plantes</span>
      <span className="text-forest/20">|</span>
      <span>🌳 {trees} arbres</span>
      <span className="text-forest/20">|</span>
      <span>📐 {zones} zones</span>
    </div>
  )
}
