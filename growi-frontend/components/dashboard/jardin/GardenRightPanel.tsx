// growi-frontend/components/dashboard/jardin/GardenRightPanel.tsx
'use client'

import type { PlantCatalog } from '@prisma/client'
import type { GardenElement, GardenConfig, LayerOrder } from '@/lib/garden/types'
import type { Plant } from '@/lib/plant-types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GardenPropsTab } from './GardenPropsTab'
import { GardenConfigTab } from './GardenConfigTab'

interface GardenRightPanelProps {
  selectedElement: GardenElement | null
  onUpdateElement: (id: string, patch: Partial<GardenElement>) => void
  onDeleteElement: (id: string) => void
  config: GardenConfig
  onUpdateConfig: (patch: Partial<GardenConfig>) => void
  plants?: Plant[]
  onAddPlant?: (catalogPlant: PlantCatalog, element: GardenElement) => Promise<void>
  onReorder?: (id: string, mode: LayerOrder) => void
}

export function GardenRightPanel({
  selectedElement,
  onUpdateElement,
  onDeleteElement,
  config,
  onUpdateConfig,
  plants = [],
  onAddPlant,
  onReorder,
}: GardenRightPanelProps) {
  return (
    <aside
      aria-label="Panneau de propriétés"
      className="hidden md:flex flex-col w-60 shrink-0 bg-white border-l border-forest/10 overflow-hidden"
    >
      <Tabs defaultValue="element" className="flex flex-col h-full overflow-hidden">
        <TabsList className="shrink-0">
          <TabsTrigger value="element">✏️ Élément</TabsTrigger>
          <TabsTrigger value="config">⚙️ Jardin</TabsTrigger>
        </TabsList>

        <TabsContent value="element" className="flex-1 overflow-y-auto min-h-0">
          {selectedElement ? (
            <GardenPropsTab
              element={selectedElement}
              onChange={patch => onUpdateElement(selectedElement.id, patch)}
              onDelete={() => onDeleteElement(selectedElement.id)}
              plants={plants}
              onAddPlant={onAddPlant}
              pxPerMeter={config.pxPerMeter}
              onReorder={onReorder ? mode => onReorder(selectedElement.id, mode) : undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
              <span className="text-4xl opacity-25" aria-hidden>🖱️</span>
              <p className="font-raleway text-xs text-forest/40">
                Clique sur un élément pour modifier ses propriétés
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="config" className="flex-1 overflow-y-auto min-h-0">
          <GardenConfigTab config={config} onChange={onUpdateConfig} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
