'use client'

import { useState } from 'react'
import { Circle, Line, Group } from 'react-konva'
import type Konva from 'konva'
import type { GardenElement, GardenPoint } from '@/lib/garden/types'
import { rectPoints } from '@/lib/garden/types'
import { snapToGrid } from '@/lib/garden/compute-sun'

// Édition de forme (polygone à n côtés) pour zones & structures.
// - sommets déplaçables
// - poignée « + » au milieu de chaque côté → ajoute un sommet
// - double-clic sur un sommet → le supprime (min 3)

const VIOLET = '#7C3AED'

interface ShapePatch {
  x: number
  y: number
  width: number
  height: number
  points: GardenPoint[]
}

/** Re-base le polygone : origine = coin haut-gauche, width/height = boîte englobante. */
function normalize(pts: GardenPoint[], x: number, y: number): ShapePatch {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    x: x + minX,
    y: y + minY,
    width: Math.max(40, maxX - minX),
    height: Math.max(40, maxY - minY),
    points: pts.map(p => ({ x: p.x - minX, y: p.y - minY })),
  }
}

/** Tolérance, en pixels du plan, pour juger deux sommets alignés. */
const ALIGNED_PX = 0.5

/** Côté minimal d'un rectangle redimensionné — celui de `normalize`. */
const MIN_SIDE_PX = 40

/** Garde `value` à au moins un côté minimal du point fixe, du côté où il est. */
function keepApart(value: number, fixed: number): number {
  return value >= fixed
    ? Math.max(value, fixed + MIN_SIDE_PX)
    : Math.min(value, fixed - MIN_SIDE_PX)
}

/**
 * Un polygone est encore un rectangle tant qu'il a quatre sommets alignés deux
 * à deux. C'est le cas de tout élément fraîchement posé.
 */
function isRectangle(pts: GardenPoint[]): boolean {
  if (pts.length !== 4) return false
  return pts.every((p, i) => {
    const next = pts[(i + 1) % 4]
    const alignedX = Math.abs(p.x - next.x) < ALIGNED_PX
    const alignedY = Math.abs(p.y - next.y) < ALIGNED_PX
    // Chaque côté est soit vertical, soit horizontal — jamais les deux.
    return alignedX !== alignedY
  })
}

/**
 * Déplace un coin de rectangle **en gardant le rectangle** : les deux sommets
 * voisins suivent, le sommet opposé ne bouge pas.
 *
 * Sans cela, tirer le coin d'un mur qu'on vient de poser le transformait en
 * quadrilatère quelconque, alors qu'on voulait le redimensionner. Ajouter un
 * sommet avec la poignée « + » reste le moyen de sortir du rectangle.
 */
function resizeRectangle(pts: GardenPoint[], index: number, x: number, y: number): GardenPoint[] {
  const corner = pts[index]
  const opposite = pts[(index + 2) % 4]
  // Sans butée, un coin tiré jusqu'à son opposé aplatirait la forme en trait.
  const nx = keepApart(x, opposite.x)
  const ny = keepApart(y, opposite.y)

  return pts.map((p, i) => {
    if (i === index) return { x: nx, y: ny }
    if (i === (index + 2) % 4) return p // le coin opposé est le point fixe
    // Des deux voisins, l'un partage l'abscisse du coin tiré, l'autre son ordonnée.
    return Math.abs(p.x - corner.x) < ALIGNED_PX ? { x: nx, y: p.y } : { x: p.x, y: ny }
  })
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const stage = e.target.getStage()
  if (stage) stage.container().style.cursor = cursor
}

interface GardenShapeEditorProps {
  element: GardenElement
  /** Origine de tracé (= position live de l'élément, suit le déplacement global). */
  originX: number
  originY: number
  onChange: (patch: Partial<GardenElement>) => void
}

export function GardenShapeEditor({ element, originX, originY, onChange }: GardenShapeEditorProps) {
  // Rectangle implicite si l'élément n'a pas encore de polygone explicite.
  const committed = element.points ?? rectPoints(element.width, element.height)
  // `working` n'existe que pendant le glissé d'un sommet (aperçu local sans
  // polluer l'historique d'annulation). Commit → onChange → reset.
  const [working, setWorking] = useState<GardenPoint[] | null>(null)
  const pts = working ?? committed
  if (pts.length < 3) return null

  const flat = pts.flatMap(p => [originX + p.x, originY + p.y])
  const rectangular = isRectangle(pts)

  function commit(next: GardenPoint[]) {
    onChange(normalize(next, originX, originY))
    setWorking(null)
  }

  /** Déplacement d'un sommet : redimensionnement tant que la forme est un rectangle. */
  function moveVertex(index: number, nx: number, ny: number): GardenPoint[] {
    return rectangular
      ? resizeRectangle(pts, index, nx, ny)
      : pts.map((q, j) => (j === index ? { x: nx, y: ny } : q))
  }

  return (
    <>
      {/* Contour de la forme en cours d'édition */}
      <Line points={flat} closed stroke={VIOLET} strokeWidth={2} dash={[7, 5]} listening={false} />

      {/* Poignées « + » au milieu de chaque côté */}
      {pts.map((p, i) => {
        const n = pts[(i + 1) % pts.length]
        const mid: GardenPoint = { x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 }
        const add = () => commit([...pts.slice(0, i + 1), mid, ...pts.slice(i + 1)])
        return (
          <Group
            key={`add-${i}`}
            x={originX + mid.x}
            y={originY + mid.y}
            onClick={add}
            onTap={add}
            onMouseEnter={e => setCursor(e, 'copy')}
            onMouseLeave={e => setCursor(e, '')}
          >
            <Circle radius={7} fill={VIOLET} opacity={0.85} />
            <Line points={[-3, 0, 3, 0]} stroke="#fff" strokeWidth={1.6} listening={false} />
            <Line points={[0, -3, 0, 3]} stroke="#fff" strokeWidth={1.6} listening={false} />
          </Group>
        )
      })}

      {/* Sommets déplaçables (double-clic = supprimer) */}
      {pts.map((p, i) => (
        <Circle
          key={`vertex-${i}`}
          x={originX + p.x}
          y={originY + p.y}
          radius={6.5}
          fill="#ffffff"
          stroke={VIOLET}
          strokeWidth={2.5}
          draggable
          onMouseEnter={e => setCursor(e, 'move')}
          onMouseLeave={e => setCursor(e, '')}
          onDragMove={e => {
            setWorking(moveVertex(i, e.target.x() - originX, e.target.y() - originY))
          }}
          onDragEnd={e => {
            commit(moveVertex(
              i,
              snapToGrid(e.target.x() - originX),
              snapToGrid(e.target.y() - originY),
            ))
          }}
          onDblClick={() => { if (pts.length > 3) commit(pts.filter((_, j) => j !== i)) }}
          onDblTap={() => { if (pts.length > 3) commit(pts.filter((_, j) => j !== i)) }}
        />
      ))}
    </>
  )
}
