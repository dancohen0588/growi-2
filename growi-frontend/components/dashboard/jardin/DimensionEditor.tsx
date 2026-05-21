'use client'

import { useEffect, useRef, useState } from 'react'
import { pxToM, mToPx, parseCote } from '@/lib/garden/scale'
import { snapToGrid } from '@/lib/garden/compute-sun'

// Système de cotation (P2) — petite saisie flottante pour éditer une cote
// au clic sur sa pastille. Position en pixels relatifs au conteneur du canevas.

interface DimensionEditorProps {
  x: number
  y: number
  axis: 'w' | 'h'
  valuePx: number
  pxPerMeter?: number
  onCommit: (px: number) => void
  onClose: () => void
}

function clampPx(px: number): number {
  return Math.max(40, Math.min(600, snapToGrid(px)))
}

export function DimensionEditor({ x, y, axis, valuePx, pxPerMeter, onCommit, onClose }: DimensionEditorProps) {
  const [val, setVal] = useState(() => pxToM(valuePx, pxPerMeter).toFixed(2).replace('.', ','))
  const inputRef = useRef<HTMLInputElement>(null)
  const committed = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit() {
    if (committed.current) return
    committed.current = true
    const m = parseCote(val)
    if (m == null) { onClose(); return }
    onCommit(clampPx(mToPx(m, pxPerMeter)))
  }

  return (
    <div
      className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1 rounded-lg border-2 border-[#7C3AED] bg-white px-1.5 py-1 shadow-card-hover">
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') { committed.current = true; onClose() }
          }}
          inputMode="decimal"
          aria-label={axis === 'w' ? 'Largeur en mètres' : 'Hauteur en mètres'}
          className="w-14 bg-transparent text-right font-mono text-xs text-forest focus:outline-none"
        />
        <span className="pr-0.5 font-poppins text-[11px] text-forest/50">m</span>
      </div>
    </div>
  )
}
