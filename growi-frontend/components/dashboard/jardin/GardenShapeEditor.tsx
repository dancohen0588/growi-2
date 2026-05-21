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

  function commit(next: GardenPoint[]) {
    onChange(normalize(next, originX, originY))
    setWorking(null)
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
            const nx = e.target.x() - originX
            const ny = e.target.y() - originY
            setWorking(pts.map((q, j) => (j === i ? { x: nx, y: ny } : q)))
          }}
          onDragEnd={e => {
            const nx = snapToGrid(e.target.x() - originX)
            const ny = snapToGrid(e.target.y() - originY)
            commit(pts.map((q, j) => (j === i ? { x: nx, y: ny } : q)))
          }}
          onDblClick={() => { if (pts.length > 3) commit(pts.filter((_, j) => j !== i)) }}
          onDblTap={() => { if (pts.length > 3) commit(pts.filter((_, j) => j !== i)) }}
        />
      ))}
    </>
  )
}
