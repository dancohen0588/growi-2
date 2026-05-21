'use client'

import { Group, Line, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import { formatCote } from '@/lib/garden/scale'

// Système de cotation (P2) — dessine les cotes (largeur en haut, hauteur à
// droite) autour d'un élément, en coordonnées « monde » Konva.

export interface DimBox {
  x: number
  y: number
  width: number
  height: number
}

interface GardenDimensionsProps {
  box: DimBox
  pxPerMeter?: number
  /** Cotes cliquables (élément sélectionné) → édition de la dimension. */
  editable?: boolean
  onEditCote?: (axis: 'w' | 'h', worldX: number, worldY: number) => void
}

const GAP = 22       // écart entre la boîte et la ligne de cote (px monde)
const TICK = 5       // demi-longueur des arrêtes
const CHIP_H = 18
const LINE = '#1E5631'

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const stage = e.target.getStage()
  if (stage) stage.container().style.cursor = cursor
}

function Cote({
  cx, cy, label, editable, onClick,
}: {
  cx: number
  cy: number
  label: string
  editable?: boolean
  onClick?: () => void
}) {
  const chipW = Math.max(42, label.length * 6.6 + 14)
  return (
    <Group
      x={cx}
      y={cy}
      listening={!!editable}
      onClick={editable ? onClick : undefined}
      onTap={editable ? onClick : undefined}
      onMouseEnter={editable ? e => setCursor(e, 'pointer') : undefined}
      onMouseLeave={editable ? e => setCursor(e, '') : undefined}
    >
      <Rect
        x={-chipW / 2} y={-CHIP_H / 2}
        width={chipW} height={CHIP_H}
        cornerRadius={9}
        fill={LINE}
        shadowColor="rgba(20,40,20,0.4)" shadowBlur={3} shadowOpacity={0.5}
      />
      <Text
        text={label}
        fontSize={11} fontStyle="bold" fontFamily="Poppins, sans-serif"
        fill="#FFFBEC"
        width={chipW} height={CHIP_H}
        x={-chipW / 2} y={-CHIP_H / 2}
        align="center" verticalAlign="middle"
        listening={false}
      />
    </Group>
  )
}

export function GardenDimensions({ box, pxPerMeter, editable, onEditCote }: GardenDimensionsProps) {
  const { x, y, width, height } = box
  const topY = y - GAP
  const rightX = x + width + GAP
  const wLabel = formatCote(width, pxPerMeter)
  const hLabel = formatCote(height, pxPerMeter)

  return (
    <>
      {/* Cote de largeur (en haut) */}
      <Line points={[x, topY, x + width, topY]} stroke={LINE} strokeWidth={1.2} opacity={0.6} listening={false} />
      <Line points={[x, topY - TICK, x, topY + TICK]} stroke={LINE} strokeWidth={1.2} opacity={0.6} listening={false} />
      <Line points={[x + width, topY - TICK, x + width, topY + TICK]} stroke={LINE} strokeWidth={1.2} opacity={0.6} listening={false} />
      <Cote
        cx={x + width / 2} cy={topY} label={wLabel} editable={editable}
        onClick={() => onEditCote?.('w', x + width / 2, topY)}
      />

      {/* Cote de hauteur (à droite) */}
      <Line points={[rightX, y, rightX, y + height]} stroke={LINE} strokeWidth={1.2} opacity={0.6} listening={false} />
      <Line points={[rightX - TICK, y, rightX + TICK, y]} stroke={LINE} strokeWidth={1.2} opacity={0.6} listening={false} />
      <Line points={[rightX - TICK, y + height, rightX + TICK, y + height]} stroke={LINE} strokeWidth={1.2} opacity={0.6} listening={false} />
      <Cote
        cx={rightX} cy={y + height / 2} label={hLabel} editable={editable}
        onClick={() => onEditCote?.('h', rightX, y + height / 2)}
      />
    </>
  )
}
