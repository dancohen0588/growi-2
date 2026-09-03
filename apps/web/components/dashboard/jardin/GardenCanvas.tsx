'use client'

import { useRef, useEffect, useState, useCallback, useMemo, useReducer } from 'react'
import Link from 'next/link'
import { Stage, Layer, Group, Rect, Ellipse, Text, Transformer, Line, Image as KonvaImage } from 'react-konva'
import type Konva from 'konva'
import { DndContext, useDroppable, useDndMonitor } from '@dnd-kit/core'
import type { DragEndEvent, DragMoveEvent } from '@dnd-kit/core'
import { Layers, SlidersHorizontal, Sprout, ScanSearch, Wand2 } from 'lucide-react'
import type { PlantCatalog } from '@prisma/client'

import { useGarden } from '@/hooks/useGarden'
import { useGardenList } from '@/hooks/useGardenList'
import { useUserProfile } from '@/hooks/useUserProfile'
import type { ParcelDetail } from '@growi/shared'
import type { GardenElement, GardenPoint } from '@/lib/garden/types'
import { effectivePoints, isSurfaceType } from '@/lib/garden/types'
import { fitBox, surfaceFromSeed } from '@/lib/garden/cadastre-seed'
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
import { GardenShapeEditor } from './GardenShapeEditor'
import { GardenAnnotationLayer } from './GardenAnnotationLayer'
import { GardenOnboarding } from './GardenOnboarding'
import { CadastreImportDialog } from './CadastreImportDialog'
import { DimensionEditor } from './DimensionEditor'
import { AnnotationEditor } from './AnnotationEditor'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

// ─── Single Konva element ─────────────────────────────────────────────────────

interface KonvaElementProps {
  element: GardenElement
  isSelected: boolean
  onSelect: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number, x: number, y: number, rotation: number, points?: GardenPoint[]) => void
  onLiveChange?: (id: string, box: DimBox | null) => void
  commentMode?: boolean
  /** Affiche le nom sous chaque élément. Si false, le nom n'apparaît qu'au survol. */
  showLabels?: boolean
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

function KonvaElement({ element, isSelected, onSelect, onMove, onResize, onLiveChange, commentMode, showLabels = true }: KonvaElementProps) {
  const groupRef = useRef<Konva.Group>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const [hovered, setHovered] = useState(false)
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

  // Polygone à n côtés : zones & structures (rectangle implicite par défaut).
  const poly = effectivePoints(element)
  const hasPolygon = !!poly && poly.length >= 3
  const flatLocal = hasPolygon ? poly!.flatMap(p => [p.x, p.y]) : []
  const polyClip = hasPolygon
    ? (ctx: Konva.Context) => {
        ctx.beginPath()
        ctx.moveTo(poly![0].x, poly![0].y)
        for (let i = 1; i < poly!.length; i++) ctx.lineTo(poly![i].x, poly![i].y)
        ctx.closePath()
      }
    : undefined

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
    // Le polygone se met à l'échelle proportionnellement à la boîte.
    let scaledPoints: GardenPoint[] | undefined
    if (element.points && element.points.length >= 3) {
      const sx = element.width ? newW / element.width : 1
      const sy = element.height ? newH / element.height : 1
      scaledPoints = element.points.map(p => ({ x: p.x * sx, y: p.y * sy }))
    }
    onResize(newW, newH, newX, newY, rotation, scaledPoints)
    onLiveChange?.(element.id, null)
  }

  const sunBadge = element.sun === 'full' ? '☀️' : element.sun === 'half' ? '⛅' : '🌿'
  // Largeur de l'infobulle de survol, estimée d'après la longueur du nom.
  const tipWidth = Math.min(180, Math.max(48, element.label.length * 5.6 + 16))
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
        listening={!commentMode}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={reportLive}
        onTransform={reportLive}
        onDragEnd={e => { setHovered(false); handleDragEnd(e) }}
        onTransformEnd={handleTransformEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {hasPolygon ? (
          <>
            <Line
              points={flatLocal}
              closed
              fill={element.customColor ?? fill}
              stroke={borderFill}
              strokeWidth={2}
              // La limite cadastrale se lit comme une limite, pas comme le
              // bord d'une zone plantée — même trait que dans le plan SVG.
              dash={element.type === 'terrain' ? [10, 6] : undefined}
            />
            {useIllustration && sprite && (
              <Group clipFunc={polyClip} listening={false}>
                <KonvaImage image={sprite} width={element.width} height={element.height} listening={false} />
              </Group>
            )}
          </>
        ) : useIllustration ? (
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
        {!useIllustration && !hasPolygon && (
          <Text text={element.emoji} fontSize={emojiSize} x={cx - emojiSize / 2} y={cy - emojiSize / 2} listening={false} />
        )}
        {/* Nom permanent sous l'élément (masquable depuis la barre d'outils). */}
        {showLabels && (
          <>
            <Rect x={cx - 30} y={element.height - 16} width={60} height={14} fill="rgba(255,255,255,0.85)" cornerRadius={3} listening={false} />
            <Text text={element.label} fontSize={10} fill="#1E5631" fontFamily="Raleway, sans-serif" x={cx - 30} y={element.height - 15} width={60} align="center" listening={false} />
          </>
        )}
        {/* Noms masqués : infobulle révélée au survol. */}
        {!showLabels && hovered && (
          <>
            <Rect
              x={cx - tipWidth / 2} y={-22}
              width={tipWidth} height={16} cornerRadius={4}
              fill="#1E5631" opacity={0.92} listening={false}
            />
            <Text
              text={element.label} fontSize={10} fill="#FFFFFF"
              fontFamily="Raleway, sans-serif" fontStyle="bold"
              x={cx - tipWidth / 2} y={-18.5} width={tipWidth} align="center"
              wrap="none" ellipsis listening={false}
            />
          </>
        )}
        <Text text={sunBadge} fontSize={12} x={2} y={2} listening={false} />
      </Group>

      {isSelected && !hasPolygon && !commentMode && (
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
  const {
    gardens,
    currentGardenId,
    selectGarden,
    createGarden: createNewGarden,
    deleteGarden: deleteCurrentGarden,
    onGardenLoaded,
    onGardenRenamed,
  } = useGardenList()
  const garden = useGarden(currentGardenId)
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [showAllCotes, setShowAllCotes] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [liveBox, setLiveBox] = useState<{ id: string; box: DimBox } | null>(null)
  const [dimEdit, setDimEdit] = useState<{ axis: 'w' | 'h'; x: number; y: number; valuePx: number } | null>(null)
  const clipboardRef = useRef<GardenElement | null>(null)
  const [commentMode, setCommentMode] = useState(false)
  const [commentsVisible, setCommentsVisible] = useState(true)
  const [onboardingActive, setOnboardingActive] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const autoOpenedRef = useRef(false)
  const [annotationEdit, setAnnotationEdit] = useState<
    { id: string | null; x: number; y: number; screenX: number; screenY: number; text: string } | null
  >(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [mobilePropsOpen, setMobilePropsOpen] = useState(false)
  const [addPlantOpen, setAddPlantOpen] = useState(false)
  const [cadastreOpen, setCadastreOpen] = useState(false)
  const { toast } = useToast()
  const { profile, updateProfile } = useUserProfile()

  // Le serveur a le dernier mot sur le jardin ouvert : au premier affichage,
  // ou quand le jardin mémorisé n'existe plus, il en renvoie un autre.
  const loadedGardenId = garden.gardenId
  useEffect(() => {
    if (loadedGardenId) onGardenLoaded(loadedGardenId)
  }, [loadedGardenId, onGardenLoaded])

  const handleDeleteGarden = useCallback(async () => {
    if (!loadedGardenId) return
    await deleteCurrentGarden(loadedGardenId)
  }, [deleteCurrentGarden, loadedGardenId])

  const handleRename = useCallback((name: string) => {
    garden.updateName(name)
    if (loadedGardenId) onGardenRenamed(loadedGardenId, name)
  }, [garden, loadedGardenId, onGardenRenamed])

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
      if (e.key === 'Escape') { setCommentMode(false); setAnnotationEdit(null); return }
      // Laisse les raccourcis natifs agir dans les champs de saisie.
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      // Suppr / Retour arrière : supprime l'élément sélectionné.
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = selectedElementRef.current
        if (el) {
          e.preventDefault()
          garden.deleteElement(el.id)
        }
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
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
  }, [garden.undo, garden.redo, garden.duplicateElement, garden.deleteElement, toast])

  // Ouvre l'assistant de création pour un jardin neuf et vide (P4).
  useEffect(() => {
    if (!garden.isLoaded || autoOpenedRef.current) return
    autoOpenedRef.current = true
    if (garden.garden.elements.length === 0 && !garden.garden.onboarding?.completed) {
      setOnboardingActive(true)
      setOnboardingStep(1)
    }
  }, [garden.isLoaded])

  // ─── Import du terrain depuis le cadastre ───────────────────────────────
  //
  // Le cadastre n'est proposé que pour un jardin en pleine terre : la parcelle
  // d'un immeuble n'a rien à voir avec un balcon, et une serre n'a pas de
  // limite cadastrale à elle.
  const currentGardenType = gardens.find(g => g.id === loadedGardenId)?.type
  const cadastreAvailable =
    currentGardenType === 'OUTDOOR' || currentGardenType === 'ALLOTMENT'
  const openCadastre = useCallback(() => setCadastreOpen(true), [])

  const handleCadastreImport = useCallback(
    (parcels: ParcelDetail[], options: { withOutline: boolean; withBuildings: boolean }) => {
      const seeded = garden.applyCadastreSeed(parcels, options)

      // La surface retenue part en base : c'est elle que lisent l'app mobile
      // et le contexte du diagnostic, pas les dimensions du canevas.
      void garden.setSurfaceM2(surfaceFromSeed(parcels, options.withBuildings))

      // Recadrage sur ce qui vient d'être posé — sans quoi le terrain, souvent
      // bien plus grand que la vue, apparaîtrait hors champ.
      const posed = new Set(seeded.config.cadastre?.elementIds ?? [])
      const box = fitBox(seeded.elements.filter(el => posed.has(el.id)))
      if (box && box.width > 0 && box.height > 0) {
        const scale = Math.min(
          2,
          Math.max(
            0.4,
            Math.min(
              (stageSize.width * 0.8) / box.width,
              (stageSize.height * 0.8) / box.height,
            ),
          ),
        )
        garden.setZoom(scale)
        setStagePos({
          x: stageSize.width / 2 - (box.x + box.width / 2) * scale,
          y: stageSize.height / 2 - (box.y + box.height / 2) * scale,
        })
      }

      toast('🗺️ Terrain importé — ajuste le contour si besoin')
    },
    [garden, stageSize.width, stageSize.height, toast],
  )

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
      // Le jardin ouvert, pas le plus récent : la plante doit rejoindre celui
      // dont on est en train de dessiner le plan.
      await addPlantToMyGarden({
        catalogPlantId: catalogPlant.id,
        gardenId:       loadedGardenId ?? undefined,
        location:       elementToLocation[element.type] ?? 'OUTDOOR',
        notes:          `Zone : ${element.label}`,
      })
    },
    [loadedGardenId],
  )

  const handleAddPlantFromCatalog = useCallback(
    async (catalogPlant: PlantCatalog) => {
      const result = await addPlantToMyGarden({
        catalogPlantId: catalogPlant.id,
        gardenId:       loadedGardenId ?? undefined,
        location:       'OUTDOOR',
      })
      if (!result.success) {
        throw new Error(result.error ?? 'Impossible d\'ajouter la plante')
      }

      const label = catalogPlant.commonName
      const emoji = catalogPlant.emoji ?? '🌿'
      // Les arbres & arbustes sont des éléments « arbre » sur le canvas.
      const isTree = catalogPlant.category === 'TREES_SHRUBS'
      const width = isTree ? 80 : 60
      const height = isTree ? 80 : 60
      // Centre de la vue en coordonnées « monde » (tient compte du zoom + pan).
      const centerX = (stageSize.width / 2 - stagePos.x) / garden.zoom - width / 2
      const centerY = (stageSize.height / 2 - stagePos.y) / garden.zoom - height / 2
      const jitter = () => Math.round((Math.random() - 0.5) * 80)

      const paletteItem: PaletteItem = {
        type: isTree ? 'arbre' : 'plante',
        emoji,
        label,
        defaultWidth: width,
        defaultHeight: height,
        isCircular: true,
      }

      // P1-c : résout le dessin v2 depuis la fiche catalogue (catégorie + nom).
      const drawKind = resolveDrawKind({
        type:     isTree ? 'arbre' : 'plante',
        emoji,
        category: catalogPlant.category,
        treeType: catalogPlant.treeType,
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
    [stageSize.width, stageSize.height, stagePos.x, stagePos.y, garden, loadedGardenId, toast],
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
          type:     item.type,
          emoji:    item.emoji,
          category: item.catalogCategory,
          treeType: item.catalogTreeType,
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
  const annotations = garden.garden.annotations ?? []

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

  // ── Commentaires (P3) ───────────────────────────────────────────────────
  const handleEditAnnotation = useCallback(
    (id: string) => {
      const a = (garden.garden.annotations ?? []).find(x => x.id === id)
      if (!a) return
      setAnnotationEdit({
        id: a.id,
        x: a.x,
        y: a.y,
        screenX: a.x * garden.zoom + stagePos.x,
        screenY: a.y * garden.zoom + stagePos.y,
        text: a.text,
      })
    },
    [garden.garden.annotations, garden.zoom, stagePos.x, stagePos.y],
  )

  return (
    <DndContext>
      <div className="flex flex-col h-full">
        <GardenToolbar
          name={garden.garden.name}
          onNameChange={handleRename}
          gardens={gardens}
          currentGardenId={loadedGardenId}
          onSelectGarden={selectGarden}
          onCreateGarden={createNewGarden}
          onDeleteGarden={handleDeleteGarden}
          onSave={garden.saveGarden}
          onExport={handleExport}
          onClear={garden.clearCanvas}
          onUndo={garden.undo}
          onRedo={garden.redo}
          canUndo={garden.canUndo}
          canRedo={garden.canRedo}
          cotesOn={showAllCotes}
          onToggleCotes={() => setShowAllCotes(v => !v)}
          labelsOn={showLabels}
          onToggleLabels={() => setShowLabels(v => !v)}
          commentMode={commentMode}
          onToggleComment={() => { setCommentMode(v => !v); setAnnotationEdit(null); setCommentsVisible(true) }}
          commentsVisible={commentsVisible}
          onToggleCommentsVisible={() => setCommentsVisible(v => !v)}
          hasComments={annotations.length > 0}
          isSaving={garden.isSaving}
        />

        <div className="flex flex-1 overflow-hidden">
          <GardenPalette />

          <CanvasDropZone onDrop={handlePaletteDrop} zoom={garden.zoom} pan={stagePos}>
            <div ref={containerRef} className={`relative w-full h-full bg-sand ${commentMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`} role="region" aria-label="Carte de ton jardin">
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

              {garden.garden.elements.length === 0 && !onboardingActive && (
                <GardenEmptyState onImportCadastre={cadastreAvailable ? openCadastre : undefined} />
              )}

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
                onClick={e => {
                  const stage = e.target.getStage()
                  // Mode commentaire : un clic dépose un nouveau commentaire.
                  if (commentMode && !annotationEdit && stage) {
                    const p = stage.getPointerPosition()
                    if (p) {
                      setAnnotationEdit({
                        id: null,
                        x: (p.x - stagePos.x) / garden.zoom,
                        y: (p.y - stagePos.y) / garden.zoom,
                        screenX: p.x,
                        screenY: p.y,
                        text: '',
                      })
                    }
                    return
                  }
                  if (e.target === stage) garden.selectElement(null)
                }}
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
                      onResize={(w, h, x, y, rotation, points) => garden.updateElement(el.id, { width: w, height: h, x, y, rotation, ...(points ? { points } : {}) })}
                      onLiveChange={handleLive}
                      commentMode={commentMode}
                      showLabels={showLabels}
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
                {/* Calque d'édition de forme — toujours actif pour zones & structures */}
                {!commentMode && garden.selectedElement && isSurfaceType(garden.selectedElement.type) && (
                  <Layer>
                    <GardenShapeEditor
                      element={garden.selectedElement}
                      originX={liveBox?.id === garden.selectedElement.id ? liveBox.box.x : garden.selectedElement.x}
                      originY={liveBox?.id === garden.selectedElement.id ? liveBox.box.y : garden.selectedElement.y}
                      onChange={patch => garden.updateElement(garden.selectedElement!.id, patch)}
                    />
                  </Layer>
                )}
                {/* Calque des commentaires (P3) — masquable */}
                {(commentsVisible || commentMode) && annotations.length > 0 && (
                  <Layer>
                    <GardenAnnotationLayer
                      annotations={annotations}
                      onEdit={handleEditAnnotation}
                      onDragEnd={(id, x, y) => garden.updateAnnotation(id, { x: Math.round(x), y: Math.round(y) })}
                    />
                  </Layer>
                )}
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

              {annotationEdit && (
                <AnnotationEditor
                  x={annotationEdit.screenX}
                  y={annotationEdit.screenY}
                  text={annotationEdit.text}
                  isExisting={annotationEdit.id != null}
                  onCommit={text => {
                    const t = text.trim()
                    if (annotationEdit.id) {
                      if (t) garden.updateAnnotation(annotationEdit.id, { text: t })
                      else garden.deleteAnnotation(annotationEdit.id)
                    } else if (t) {
                      garden.addAnnotation(annotationEdit.x, annotationEdit.y, t)
                    }
                    setAnnotationEdit(null)
                  }}
                  onDelete={() => {
                    if (annotationEdit.id) garden.deleteAnnotation(annotationEdit.id)
                    setAnnotationEdit(null)
                  }}
                  onClose={() => setAnnotationEdit(null)}
                />
              )}
            </div>

            {/* Actions principales flottantes (sorties de la toolbar) */}
            <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 items-end">
              <button
                onClick={() => setAddPlantOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-lime hover:bg-lime-hover pl-3 pr-3.5 py-2 font-poppins font-semibold text-xs text-forest shadow-card-hover transition-all hover:-translate-y-0.5"
                title="Ajouter une plante au jardin"
                aria-label="Ajouter une plante au jardin"
              >
                <Sprout size={15} aria-hidden />
                <span className="hidden sm:inline">Ajouter une plante</span>
              </button>
              <Link
                href="/dashboard/identifier"
                className="flex items-center gap-1.5 rounded-full bg-forest hover:bg-forest/90 pl-3 pr-3.5 py-2 font-poppins font-semibold text-xs text-white shadow-card-hover transition-all hover:-translate-y-0.5"
                title="Identifier une plante en photo"
                aria-label="Identifier une plante en photo"
              >
                <ScanSearch size={15} aria-hidden />
                <span className="hidden sm:inline">Identifier</span>
              </Link>
            </div>

            <GardenCompass
              compassDeg={garden.garden.config.compassDeg}
              onRotate={deg => garden.updateConfig({ compassDeg: deg })}
            />
            <GardenStatsBar elements={garden.garden.elements} />
            <GardenZoomControls zoom={garden.zoom} onZoom={garden.setZoom} />

            {/* Assistant de création (P4) */}
            {onboardingActive ? (
              <GardenOnboarding
                step={onboardingStep}
                onStepChange={s => {
                  if (s > onboardingStep) toast('🌱 Étape validée !')
                  setOnboardingStep(Math.max(1, Math.min(4, s)))
                }}
                config={garden.garden.config}
                onConfigChange={garden.updateConfig}
                cadastreAvailable={cadastreAvailable}
                addressLabel={profile?.address ?? null}
                onOpenCadastre={openCadastre}
                onActivateComments={() => setCommentMode(true)}
                onClose={() => setOnboardingActive(false)}
                onComplete={() => {
                  garden.completeOnboarding()
                  setOnboardingActive(false)
                  toast('🎉 Ton jardin est prêt !')
                }}
              />
            ) : (
              <button
                onClick={() => { setOnboardingActive(true); setOnboardingStep(1) }}
                className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-white border border-forest/15 shadow-card px-3 py-2 font-poppins font-semibold text-xs text-forest hover:bg-lime/20 transition-colors"
                title="Ouvrir l'assistant de création"
                aria-label="Ouvrir l'assistant de création"
              >
                <Wand2 size={14} aria-hidden /> Assistant
              </button>
            )}

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
                      onReorder={mode => garden.reorderElement(garden.selectedElement!.id, mode)}
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
            onImportCadastre={cadastreAvailable ? openCadastre : undefined}
            onAddPlant={handleAddPlantToZone}
            onReorder={garden.reorderElement}
          />
        </div>

        <AddPlantToGardenSheet
          open={addPlantOpen}
          onOpenChange={setAddPlantOpen}
          onPlantSelected={handleAddPlantFromCatalog}
        />

        {/* Monté seulement à l'ouverture : le dialogue interroge l'IGN dès
            qu'il s'affiche, il n'a rien à faire tant qu'on ne l'ouvre pas. */}
        {cadastreOpen && (
          <CadastreImportDialog
            open
            onOpenChange={setCadastreOpen}
            latitude={profile?.latitude}
            longitude={profile?.longitude}
            address={profile?.address ?? null}
            onSaveAddress={async (addr, lat, lon) => {
              await updateProfile({ address: addr, latitude: lat, longitude: lon })
            }}
            hasElements={garden.garden.elements.length > 0}
            onImport={handleCadastreImport}
          />
        )}
      </div>
    </DndContext>
  )
}
