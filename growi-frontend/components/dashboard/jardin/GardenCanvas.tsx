'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Group, Rect, Ellipse, Text, Transformer, Line } from 'react-konva'
import type Konva from 'konva'
import { DndContext, useDroppable, useDndMonitor } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { Layers } from 'lucide-react'

import { useGarden } from '@/hooks/useGarden'
import type { GardenElement } from '@/lib/garden/types'
import type { PaletteItem } from '@/lib/garden/palette'
import { getTypeColors, snapToGrid } from '@/lib/garden/compute-sun'

import { GardenToolbar } from './GardenToolbar'
import { GardenPalette } from './GardenPalette'
import { GardenRightPanel } from './GardenRightPanel'
import { GardenCompass } from './GardenCompass'
import { GardenEmptyState } from './GardenEmptyState'
import { GardenStatsBar } from './GardenStatsBar'
import { GardenZoomControls } from './GardenZoomControls'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// ─── Single Konva element ─────────────────────────────────────────────────────

interface KonvaElementProps {
  element: GardenElement
  isSelected: boolean
  onSelect: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number, x: number, y: number, rotation: number) => void
}

function KonvaElement({ element, isSelected, onSelect, onMove, onResize }: KonvaElementProps) {
  const groupRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { fill, stroke } = getTypeColors(element.type)
  const isCircular = ['plante', 'arbre', 'fontaine', 'mare'].includes(element.type)

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const emojiSize = Math.max(14, Math.min(element.width, element.height) * 0.45)
  const cx = element.width / 2
  const cy = element.height / 2

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const snappedX = snapToGrid(e.target.x())
    const snappedY = snapToGrid(e.target.y())
    e.target.x(snappedX)
    e.target.y(snappedY)
    onMove(snappedX, snappedY)
  }

  function handleTransformEnd() {
    const node = groupRef.current
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const rotation = node.rotation()
    const newW = Math.max(40, Math.round((node.width() * scaleX) / 20) * 20)
    const newH = Math.max(40, Math.round((node.height() * scaleY) / 20) * 20)
    const newX = snapToGrid(node.x())
    const newY = snapToGrid(node.y())
    node.scaleX(1)
    node.scaleY(1)
    onResize(newW, newH, newX, newY, rotation)
  }

  const sunBadge = element.sun === 'full' ? '☀️' : element.sun === 'half' ? '⛅' : '🌿'
  const bgFill = element.customColor ?? fill
  const borderFill = element.customBorder ?? stroke
  const cornerRadius = isCircular ? 999
    : ['pelouse', 'massif', 'potager', 'serre', 'allee', 'rocaille'].includes(element.type) ? 12
    : 4

  return (
    <>
      <Group
        ref={groupRef}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {isCircular ? (
          <Ellipse
            x={cx} y={cy}
            radiusX={cx} radiusY={cy}
            fill={bgFill} stroke={borderFill} strokeWidth={2}
          />
        ) : (
          <Rect
            width={element.width} height={element.height}
            fill={bgFill} stroke={borderFill} strokeWidth={2}
            cornerRadius={cornerRadius}
          />
        )}
        <Text text={element.emoji} fontSize={emojiSize} x={cx - emojiSize / 2} y={cy - emojiSize / 2} listening={false} />
        <Rect x={cx - 30} y={element.height - 16} width={60} height={14} fill="rgba(255,255,255,0.85)" cornerRadius={3} listening={false} />
        <Text text={element.label} fontSize={10} fill="#1E5631" fontFamily="Raleway, sans-serif" x={cx - 30} y={element.height - 15} width={60} align="center" listening={false} />
        <Text text={sunBadge} fontSize={12} x={2} y={2} listening={false} />
      </Group>

      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(40, newBox.width),
            height: Math.max(40, newBox.height),
          })}
        />
      )}
    </>
  )
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function GridLayer({ width, height }: { width: number; height: number }) {
  const lines: React.ReactNode[] = []
  const G = 40
  for (let x = 0; x <= width; x += G)
    lines.push(<Line key={`v${x}`} points={[x, 0, x, height]} stroke="rgba(180,221,127,0.2)" strokeWidth={1} listening={false} />)
  for (let y = 0; y <= height; y += G)
    lines.push(<Line key={`h${y}`} points={[0, y, width, y]} stroke="rgba(180,221,127,0.2)" strokeWidth={1} listening={false} />)
  return <>{lines}</>
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

const CANVAS_ID = 'garden-canvas-droppable'

function CanvasDropZone({ children, onDrop }: { children: React.ReactNode; onDrop: (item: PaletteItem, x: number, y: number) => void }) {
  const { setNodeRef } = useDroppable({ id: CANVAS_ID })
  const dragPosRef = useRef({ x: 0, y: 0 })

  useDndMonitor({
    onDragMove(event) {
      const init = event.activatorEvent as PointerEvent
      dragPosRef.current = { x: init.clientX + event.delta.x, y: init.clientY + event.delta.y }
    },
    onDragEnd(event: DragEndEvent) {
      if (!event.over || event.over.id !== CANVAS_ID) return
      const item = event.active.data.current as PaletteItem
      const el = document.getElementById(CANVAS_ID)
      if (!el) return
      const rect = el.getBoundingClientRect()
      const relX = dragPosRef.current.x - rect.left - item.defaultWidth / 2
      const relY = dragPosRef.current.y - rect.top - item.defaultHeight / 2
      onDrop(item, Math.max(0, relX), Math.max(0, relY))
    },
  })

  return (
    <div ref={setNodeRef} id={CANVAS_ID} className="flex-1 relative overflow-hidden">
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function GardenCanvas() {
  const garden = useGarden()
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function measure() {
      setStageSize({
        width: container!.clientWidth,
        height: container!.clientHeight,
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const handleExport = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = `${garden.garden.name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = dataUrl
    link.click()
  }, [garden.garden.name])

  return (
    <DndContext>
      <div className="flex flex-col h-full">
        <GardenToolbar
          name={garden.garden.name}
          onNameChange={garden.updateName}
          onSave={garden.saveGarden}
          onExport={handleExport}
          onClear={garden.clearCanvas}
          isSaving={garden.isSaving}
        />

        <div className="flex flex-1 overflow-hidden">
          <GardenPalette />

          <CanvasDropZone onDrop={garden.addElement}>
            <div ref={containerRef} className="w-full h-full" role="region" aria-label="Carte de ton jardin">
              {/* Accessible table for screen readers */}
              <table className="sr-only" aria-label="Éléments dans ton jardin">
                <caption>Éléments de ton jardin</caption>
                <thead><tr><th scope="col">Nom</th><th scope="col">Type</th><th scope="col">X</th><th scope="col">Y</th></tr></thead>
                <tbody>
                  {garden.garden.elements.map(el => (
                    <tr key={el.id}><td>{el.label}</td><td>{el.type}</td><td>{el.x}px</td><td>{el.y}px</td></tr>
                  ))}
                </tbody>
              </table>

              {garden.garden.elements.length === 0 && <GardenEmptyState />}

              <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={garden.zoom}
                scaleY={garden.zoom}
                onClick={e => { if (e.target === e.target.getStage()) garden.selectElement(null) }}
              >
                <Layer>
                  <Rect width={stageSize.width} height={stageSize.height} fill="#F9F7E8" listening={false} />
                  <GridLayer width={stageSize.width} height={stageSize.height} />
                </Layer>
                <Layer>
                  {garden.garden.elements.map(el => (
                    <KonvaElement
                      key={el.id}
                      element={el}
                      isSelected={garden.selectedId === el.id}
                      onSelect={() => garden.selectElement(el.id)}
                      onMove={(x, y) => garden.updateElement(el.id, { x, y })}
                      onResize={(w, h, x, y, rotation) => garden.updateElement(el.id, { width: w, height: h, x, y, rotation })}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>

            <GardenCompass
              compassDeg={garden.garden.config.compassDeg}
              onRotate={deg => garden.updateConfig({ compassDeg: deg })}
            />
            <GardenStatsBar elements={garden.garden.elements} />
            <GardenZoomControls zoom={garden.zoom} onZoom={garden.setZoom} />

            {/* Mobile FAB — only visible on small screens */}
            <button
              onClick={() => setMobileSheetOpen(true)}
              className="md:hidden absolute bottom-16 right-3 z-30 w-12 h-12 rounded-full bg-lime shadow-lg flex items-center justify-center hover:bg-lime-hover transition-colors"
              aria-label="Ouvrir la palette d'éléments"
              title="Palette d'éléments"
            >
              <Layers size={20} className="text-forest" aria-hidden />
            </button>

            <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
              <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
                <SheetHeader className="px-4 py-3 border-b border-forest/10">
                  <SheetTitle className="font-poppins text-sm text-forest">Palette d&apos;éléments</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  <GardenPalette embedded />
                </div>
              </SheetContent>
            </Sheet>
          </CanvasDropZone>

          <GardenRightPanel
            selectedElement={garden.selectedElement}
            onUpdateElement={(id, patch) => garden.updateElement(id, patch)}
            onDeleteElement={id => garden.deleteElement(id)}
            config={garden.garden.config}
            onUpdateConfig={garden.updateConfig}
          />
        </div>
      </div>
    </DndContext>
  )
}
