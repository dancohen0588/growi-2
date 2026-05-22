'use client'

import { Group, Circle, Rect, Text, Ellipse } from 'react-konva'
import type Konva from 'konva'
import type { GardenAnnotation } from '@/lib/garden/types'

// Commentaires sur le plan (P3) — épingle numérotée + bulle de texte.

const FOREST = '#1E5631'
const BUBBLE_W = 168

/** Hauteur estimée de la bulle selon le texte (retours + repli sur ~27 caractères). */
function bubbleHeight(text: string): number {
  const lines = text
    .split('\n')
    .reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 27)), 0)
  return Math.max(28, lines * 14 + 12)
}

function setCursor(e: Konva.KonvaEventObject<MouseEvent>, cursor: string) {
  const stage = e.target.getStage()
  if (stage) stage.container().style.cursor = cursor
}

interface GardenAnnotationLayerProps {
  annotations: GardenAnnotation[]
  onEdit: (id: string) => void
  onDragEnd: (id: string, x: number, y: number) => void
}

export function GardenAnnotationLayer({ annotations, onEdit, onDragEnd }: GardenAnnotationLayerProps) {
  return (
    <>
      {annotations.map((a, i) => {
        const text = a.text.trim()
        const bh = text ? bubbleHeight(text) : 0
        return (
          <Group
            key={a.id}
            x={a.x}
            y={a.y}
            draggable
            onClick={e => { e.cancelBubble = true; onEdit(a.id) }}
            onTap={e => { e.cancelBubble = true; onEdit(a.id) }}
            onDragEnd={e => onDragEnd(a.id, e.target.x(), e.target.y())}
            onMouseEnter={e => setCursor(e, 'pointer')}
            onMouseLeave={e => setCursor(e, '')}
          >
            {/* Bulle de texte */}
            {text && (
              <>
                <Rect
                  x={18} y={-bh / 2}
                  width={BUBBLE_W} height={bh}
                  cornerRadius={8}
                  fill="#FFFBEC"
                  stroke={FOREST} strokeWidth={1.2}
                  shadowColor="rgba(20,40,20,0.3)" shadowBlur={4} shadowOpacity={0.4} shadowOffsetY={1}
                />
                <Text
                  x={26} y={-bh / 2 + 6}
                  width={BUBBLE_W - 16}
                  text={text}
                  fontSize={11} fontFamily="Raleway, sans-serif" fill={FOREST}
                  lineHeight={1.27}
                  listening={false}
                />
              </>
            )}

            {/* Épingle numérotée */}
            <Ellipse x={1} y={15} radiusX={11} radiusY={4} fill="rgba(20,40,20,0.25)" listening={false} />
            <Circle radius={13} fill={FOREST} stroke="#FFFBEC" strokeWidth={2} />
            <Text
              x={-13} y={-13}
              width={26} height={26}
              text={String(i + 1)}
              fontSize={13} fontStyle="bold" fontFamily="Poppins, sans-serif" fill="#FFFBEC"
              align="center" verticalAlign="middle"
              listening={false}
            />
          </Group>
        )
      })}
    </>
  )
}
