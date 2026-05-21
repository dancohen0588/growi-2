'use client'

import { useRef, useEffect, useState, useCallback, useMemo, useReducer } from 'react'
import { Stage, Layer, Group, Rect, Ellipse, Text, Transformer, Line, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import { DndContext, useDroppable, useDndMonitor } from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent } from '@dnd-kit/core'
import { Layers, SlidersHorizontal } from 'lucide-react'
import type { PlantCatalog } from '@prisma/client'

import { useGarden } from '@/hooks/useGarden'
import type { GardenElement } from '@/lib/garden/types'
import type { PaletteItem } from '@/lib/garden/palette'
import { getTypeColors, snapToGrid } from '@/lib/garden/compute-sun'
import { resolveDrawKind, getSpriteUrl, getSpriteImage } from '@/lib/garden/illustration'
import { addPlantToMyGarden } from '@/lib/actions/plant.actions'

import { GardenToolbar } from './GardenToolbar'
import { GardenPalette } from './GardenPalette'
import { GardenRightPanel } from './GardenRightPanel'
import { GardenPropsTab } from './GardenPropsTab'
import { AddPlantToGardenSheet } from './AddPlantToGardenSheet'
import { useToast } from '@/components/ui/toast'
import { GardenCompass } from './GardenCompass'
import { GardenEmptyState } from './GardenEmptyState'
import { GardenStatsBar } from './GardenStatsBar'
import { GardenZoomControls } from './GardenZoomControls'
import { GardenDimensions, type DimBox } from './GardenDimensions'
import { DimensionEditor } from './DimensionEditor'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// ─── Single Konva element ─────────────────────────────────────────────────────

interface KonvaElementProps {
  element: GardenElement
  isSelected: boolean
  onSelect: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number, x: number, y: number, rotation: number) => void
  onLiveChange?: (id: string, box: DimBox | null) => void
}

/** Charge (et garde en cache) le sprite SVG rasterisé d'un élément. */
function useSpriteImage(url: string): HTMLImageElement | null {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const img = useMemo(() => (url ? getSpriteImage(url) : null), [url])
  useEffect(() => {
    if (!img || img.complete) return
    const onLoad = () => force()
    img.addEventListener('load', onLoad)
    return () => img.removeEventListener('load', onLoad)
  }, [img])
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

function KonvaElement({ element, isSelected, onSelect, onMove, onResize, onLiveChange }: KonvaElementProps) {
  const groupRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const { fill, stroke } = getTypeColors(element.type)
  const isCircular = ['plante', 'arbre', 'fontaine', 'mare'].includes(element.type)

  // Rendu v2 illustré : chaque élément est dessiné en sprite SVG.
  // Si l'utilisateur a forcé une couleur custom, on conserve le rendu legacy.
  const useIllustration = !element.customColor
  const drawKind = element.drawKind ?? resolveDrawKind({ type: element.type, emoji: element.emoji })
  const spriteUrl = useMemo(
    () => (useIllustration ? getSpriteUrl(drawKind, element.width, element.height, element.id) : ''),
    [useIllustration, drawKind, element.width, element.height, element.id],
  )
  const sprite = useSpriteImage(spriteUrl)

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const emojiSize = Math.max(14, Math.min(element.width, element.height) * 0.45)
  const cx = element.width / 2
  const cy = element.height / 2

  function reportLive() {
    const n = groupRef.current
    if (n) onLiveChange?.(element.id, {
      x: n.x(),
      y: n.y(),
      width: Math.max(40, n.width() * n.scaleX()),
      height: Math.max(40, n.height() * n.scaleY()),
    })
  }

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    const snappedX = snapToGrid(e.target.x())
    const snappedY = snapToGrid(e.target.y())
    e.target.x(snappedX)
    e.target.y(snappedY)
    onMove(snappedX, snappedY)
    onLiveChange?.(element.id, null)
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
    onLiveChange?.(element.id, null)
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
        onDragMove={reportLive}
        onTransform={reportLive}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {useIllustration ? (
          sprite ? (
            <KonvaImage image={sprite} width={element.width} height={element.height} />
          ) : (
            <Rect
              width={element.width} height={element.height}
              fill="rgba(180,221,127,0.14)"
              cornerRadius={cornerRadius}
            />
          )
        ) : isCircular ? (
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
        {!useIllustration && (
          <Text text={element.emoji} fontSize={emojiSize} x={cx - emojiSize / 2} y={cy - emojiSize / 2} listening={false} />
        )}
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

// Bornes du « monde » : assez grandes pour que le déplacement (pan) reste
// toujours au-dessus de la grille et du fond.
const WORLD_MIN = -2000
const WORLD_MAX = 4000
const WORLD_SPAN = WORLD_MAX - WORLD_MIN

function GridLayer() {
  const lines: React.ReactNode[] = []
  const G = 40
  for (let x = WORLD_MIN; x <= WORLD_MAX; x += G)
    lines.push(<Line key={`v${x}`} points={[x, WORLD_MIN, x, WORLD_MAX]} stroke="rgba(180,221,127,0.2)" strokeWidth={1} listening={false} />)
  for (let y = WORLD_MIN; y <= WORLD_MAX; y += G)
    lines.push(<Line key={`h${y}`} points={[WORLD_MIN, y, WORLD_MAX, y]} stroke="rgba(180,221,127,0.2)" strokeWidth={1} listening={false} />)
  return <>{lines}</>
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

const CANVAS_ID = 'garden-canvas-droppable'

function CanvasDropZone({ children, onDrop, zoom, pan }: {
  children: React.ReactNode
  onDrop: (item: PaletteItem, x: number, y: number) => void
  zoom: number
  pan: { x: number; y: number }
}) {
  const { setNodeRef } = useDroppable({ id: CANVAS_ID })
  const dragPosRef = useRef({ x: 0, y: 0 })

  useDndMonitor({
    onDragMove(event: DragMoveEvent) {
      const init = event.activatorEvent as PointerEvent
      dragPosRef.current = { x: init.clientX + event.delta.x, y: init.clientY + event.delta.y }
    },
    onDragEnd(event: DragEndEvent) {
      if (!event.over || event.over.id !== CANVAS_ID) return
      const item = event.active.data.current as PaletteItem
      const el = document.getElementById(CANVAS_ID)
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Écran → coordonnées « monde » : tient compte du zoom et du pan.
      const worldX = (dragPosRef.current.x - rect.left - pan.x) / zoom
      const worldY = (dragPosRef.current.y - rect.top - pan.y) / zoom
      onDrop(item, worldX - item.defaultWidth / 2, worldY - item.defaultHeight / 2)
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
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [showAllCotes, setShowAllCotes] = useState(false)
  const [liveBox, setLiveBox] = useState<{ id: string; box: DimBox } | null>(null)
  const [dimEdit, setDimEdit] = useState<{ axis: 'w' | 'h'; x: number; y: number; valuePx: number } | null>(null)
  const clipboardRef = useRef<GardenElement | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false)
  const [addPlantOpen, setAddPlantOpen] = useState(false)
  const { toast } = useToast()

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

  // Raccourcis clavier : annuler / rétablir / copier / coller.
  const selectedElementRef = useRef(garden.selectedElement)
  selectedElementRef.current = garden.selectedElement
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      // Laisse les raccourcis natifs agir dans les champs de saisie.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        garden.undo()
      } else if ((k === 'z' && e.shiftKey) || (k === 'y' && !e.shiftKey)) {
        e.preventDefault()
        garden.redo()
      } else if (k === 'c' && !e.shiftKey) {
        // Copier l'élément sélectionné dans le presse-papiers.
        const el = selectedElementRef.current
        if (el) {
          clipboardRef.current = { ...el }
          e.preventDefault()
          toast('📋 Élément copié — Ctrl/Cmd + V pour coller')
        }
      } else if (k === 'v' && !e.shiftKey) {
        // Coller : duplique le composant copié, en cascade si on recolle.
        const clip = clipboardRef.current
        if (clip) {
          e.preventDefault()
          garden.duplicateElement(clip)
          clipboardRef.current = { ...clip, x: clip.x + 20, y: clip.y + 20 }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [garden.undo, garden.redo, garden.duplicateElement, toast])

  const handleExport = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = `${garden.garden.name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = dataUrl
    link.click()
  }, [garden.garden.name])

  const handleAddPlantToZone = useCallback(
    async (catalogPlant: PlantCatalog, element: GardenElement) => {
      const elementToLocation: Record<string, 'OUTDOOR' | 'INDOOR' | 'GREENHOUSE' | 'BALCONY'> = {
        serre: 'GREENHOUSE',
      }
      await addPlantToMyGarden({
        catalogPlantId: catalogPlant.id,
        location:       elementToLocation[element.type] ?? 'OUTDOOR',
        notes:          `Zone : ${element.label}`,
      })
    },
    [],
  )

  const handleAddPlantFromCatalog = useCallback(
    async (catalogPlant: PlantCatalog) => {
      const result = await addPlantToMyGarden({
        catalogPlantId: catalogPlant.id,
        location:       'OUTDOOR',
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Impossible d\'ajouter la plante')
      }

      const label = catalogPlant.commonName
      const emoji = catalogPlant.emoji ?? '🌿'
      const width = 60
      const height = 60
      // Centre de la vue en coordonnées « monde » (tient compte du zoom + pan).
      const centerX = (stageSize.width / 2 - stagePos.x) / garden.zoom - width / 2
      const centerY = (stageSize.height / 2 - stagePos.y) / garden.zoom - height / 2
      const jitter = () => Math.round((Math.random() - 0.5) * 80)

      const paletteItem: PaletteItem = {
        type: 'plante',
        emoji,
        label,
        defaultWidth: width,
        defaultHeight: height,
        isCircular: true,
      }

      // P1-c : résout le dessin v2 depuis la fiche catalogue (catégorie + nom).
      const drawKind = resolveDrawKind({
        type:     'plante',
        emoji,
        category: catalogPlant.category,
        slug:     catalogPlant.slug,
        name:     catalogPlant.commonName,
      })
      // Ajout + dessin + lien en une seule mutation → une seule annulation.
      garden.addElement(
        paletteItem,
        Math.max(0, centerX + jitter()),
        Math.max(0, centerY + jitter()),
        {
          drawKind,
          ...(result.plant?.id ? { linkedPlantId: result.plant.id } : {}),
        },
      )

      garden.saveGarden()
      toast(`🌿 ${label} a été ajoutée à ton jardin !`)
    },
    [stageSize.width, stageSize.height, stagePos.x, stagePos.y, garden, toast],
  )

  // Handle drag-and-drop from palette — create PlantInstance for catalog plants
  const handlePaletteDrop = useCallback(
    async (item: PaletteItem, x: number, y: number) => {
      if (item.catalogPlantId) {
        // Plant from catalog: create a real PlantInstance in DB
        const result = await addPlantToMyGarden({
          catalogPlantId: item.catalogPlantId,
          location: 'OUTDOOR',
        })

        // P1-c : résout le dessin v2 depuis la catégorie catalogue.
        const drawKind = resolveDrawKind({
          type:     'plante',
          emoji:    item.emoji,
          category: item.catalogCategory,
          name:     item.label,
        })
        // Ajout + dessin + lien en une seule mutation → une seule annulation.
        garden.addElement(item, x, y, {
          drawKind,
          ...(result.success && result.plant?.id ? { linkedPlantId: result.plant.id } : {}),
        })

        garden.saveGarden()
        toast(`🌿 ${item.label} a été ajoutée à ton jardin !`)
      } else {
        // Non-plant item (zone, structure, etc.): just add to canvas
        garden.addElement(item, x, y)
      }

      return ''
    },
    [garden, toast],
  )

  // ── Cotation (P2) ───────────────────────────────────────────────────────
  const pxPerMeter = garden.garden.config.pxPerMeter

  const handleLive = useCallback((id: string, box: DimBox | null) => {
    setLiveBox(box ? { id, box } : null)
  }, [])

  const handleEditCote = useCallback(
    (axis: 'w' | 'h', worldX: number, worldY: number) => {
      const el = garden.selectedElement
      if (!el) return
      setDimEdit({
        axis,
        x: worldX * garden.zoom + stagePos.x,
        y: worldY * garden.zoom + stagePos.y,
        valuePx: axis === 'w' ? el.width : el.height,
      })
    },
    [garden.selectedElement, garden.zoom, stagePos.x, stagePos.y],
  )

  return (
    <DndContext>
      <div className="flex flex-col h-full">
        <GardenToolbar
          name={garden.garden.name}
          onNameChange={garden.updateName}
          onSave={garden.saveGarden}
          onExport={handleExport}
          onClear={garden.clearCanvas}
          onAddPlant={() => setAddPlantOpen(true)}
          onUndo={garden.undo}
          onRedo={garden.redo}
          canUndo={garden.canUndo}
          canRedo={garden.canRedo}
          cotesOn={showAllCotes}
          onToggleCotes={() => setShowAllCotes(v => !v)}
          isSaving={garden.isSaving}
        />

        <div className="flex flex-1 overflow-hidden">
          <GardenPalette />

          <CanvasDropZone onDrop={handlePaletteDrop} zoom={garden.zoom} pan={stagePos}>
            <div ref={containerRef} className="relative w-full h-full bg-sand cursor-grab active:cursor-grabbing" role="region" aria-label="Carte de ton jardin">
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
                x={stagePos.x}
                y={stagePos.y}
                draggable
                onDragEnd={e => {
                  // Ne capture que le déplacement de la carte (pas celui d'un élément).
                  if (e.target === e.target.getStage()) setStagePos({ x: e.target.x(), y: e.target.y() })
                }}
                onWheel={e => {
                  // Pincement du trackpad (ou Ctrl + molette) → zoom vers le curseur.
                  if (!e.evt.ctrlKey) return
                  e.evt.preventDefault()
                  const stage = e.target.getStage()
                  const pointer = stage?.getPointerPosition()
                  if (!stage || !pointer) return
                  const oldScale = stage.scaleX()
                  const worldX = (pointer.x - stage.x()) / oldScale
                  const worldY = (pointer.y - stage.y()) / oldScale
                  const dy = Math.max(-60, Math.min(60, e.evt.deltaY))
                  const next = Math.min(2, Math.max(0.4, oldScale * Math.exp(-dy * 0.01)))
                  const nx = pointer.x - worldX * next
                  const ny = pointer.y - worldY * next
                  stage.scale({ x: next, y: next })
                  stage.position({ x: nx, y: ny })
                  stage.batchDraw()
                  garden.setZoom(next)
                  setStagePos({ x: nx, y: ny })
                }}
                onClick={e => { if (e.target === e.target.getStage()) garden.selectElement(null) }}
              >
                <Layer>
                  <Rect x={WORLD_MIN} y={WORLD_MIN} width={WORLD_SPAN} height={WORLD_SPAN} fill="#F9F7E8" listening={false} />
                  <GridLayer />
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
                      onLiveChange={handleLive}
                    />
                  ))}
                </Layer>
                {/* Calque de cotation (P2) */}
                <Layer>
                  {garden.garden.elements.map(el => {
                    const isSel = el.id === garden.selectedId
                    if (!showAllCotes && !isSel) return null
                    const box: DimBox = liveBox && liveBox.id === el.id
                      ? liveBox.box
                      : { x: el.x, y: el.y, width: el.width, height: el.height }
                    return (
                      <GardenDimensions
                        key={el.id}
                        box={box}
                        pxPerMeter={pxPerMeter}
                        editable={isSel}
                        onEditCote={isSel ? handleEditCote : undefined}
                      />
                    )
                  })}
                </Layer>
              </Stage>

              {dimEdit && garden.selectedId && (
                <DimensionEditor
                  x={dimEdit.x}
                  y={dimEdit.y}
                  axis={dimEdit.axis}
                  valuePx={dimEdit.valuePx}
                  pxPerMeter={pxPerMeter}
                  onCommit={px => {
                    garden.updateElement(garden.selectedId!, dimEdit.axis === 'w' ? { width: px } : { height: px })
                    setDimEdit(null)
                  }}
                  onClose={() => setDimEdit(null)}
                />
              )}
            </div>

            <GardenCompass
              compassDeg={garden.garden.config.compassDeg}
              onRotate={deg => garden.updateConfig({ compassDeg: deg })}
            />
            <GardenStatsBar elements={garden.garden.elements} />
            <GardenZoomControls zoom={garden.zoom} onZoom={garden.setZoom} />

            {/* Mobile FABs — only visible on small screens */}
            <button
              onClick={() => setMobileSheetOpen(true)}
              className="md:hidden absolute bottom-16 right-3 z-30 w-12 h-12 rounded-full bg-lime shadow-lg flex items-center justify-center hover:bg-lime-hover transition-colors"
              aria-label="Ouvrir la palette d'éléments"
              title="Palette d'éléments"
            >
              <Layers size={20} className="text-forest" aria-hidden />
            </button>

            {garden.selectedElement && (
              <button
                onClick={() => setMobilePropsOpen(true)}
                className="md:hidden absolute bottom-32 right-3 z-30 w-12 h-12 rounded-full bg-white border-2 border-lime shadow-lg flex items-center justify-center hover:bg-lime/10 transition-colors"
                aria-label="Propriétés de l'élément sélectionné"
                title="Propriétés"
              >
                <SlidersHorizontal size={18} className="text-forest" aria-hidden />
              </button>
            )}

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

            <Sheet open={mobilePropsOpen} onOpenChange={setMobilePropsOpen}>
              <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
                <SheetHeader className="px-4 py-3 border-b border-forest/10">
                  <SheetTitle className="font-poppins text-sm text-forest">
                    Propriétés de l&apos;élément
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto">
                  {garden.selectedElement && (
                    <GardenPropsTab
                      element={garden.selectedElement}
                      onChange={patch => garden.updateElement(garden.selectedElement!.id, patch)}
                      onDelete={() => {
                        garden.deleteElement(garden.selectedElement!.id)
                        setMobilePropsOpen(false)
                      }}
                      onAddPlant={handleAddPlantToZone}
                      pxPerMeter={garden.garden.config.pxPerMeter}
                    />
                  )}
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
            onAddPlant={handleAddPlantToZone}
          />
        </div>

        <AddPlantToGardenSheet
          open={addPlantOpen}
          onOpenChange={setAddPlantOpen}
          onPlantSelected={handleAddPlantFromCatalog}
        />
      </div>
    </DndContext>
  )
}
