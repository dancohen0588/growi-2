'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getSunArcPath } from '@/lib/garden/compute-sun'

interface GardenCompassProps {
  compassDeg: number
  onRotate: (deg: number) => void
}

export function GardenCompass({ compassDeg, onRotate }: GardenCompassProps) {
  const [pos, setPos] = useState({ x: 12, y: 60 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, ox: 0, oy: 0 })

  const { d: arcPath, sunDirection } = getSunArcPath(compassDeg)

  function rotate(delta: number) {
    const next = ((compassDeg + delta) % 360 + 360) % 360
    onRotate(next)
  }

  function onMouseDown(e: React.MouseEvent) {
    // Only drag from the header area, not the buttons
    if ((e.target as HTMLElement).closest('button')) return
    setDragging(true)
    setDragStart({ mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y })
    e.preventDefault()
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    setPos({
      x: dragStart.ox + e.clientX - dragStart.mx,
      y: dragStart.oy + e.clientY - dragStart.my,
    })
  }

  function onMouseUp() {
    setDragging(false)
  }

  const deg = Math.round(compassDeg)
  // The needle arrow points to actual north: rotate needle so that
  // when compassDeg=180 (south-facing), the north arrow points up (toward north)
  const needleAngle = (compassDeg + 180) % 360

  return (
    <div
      className={cn(
        'absolute z-20 bg-white border border-forest/15 rounded-xl p-3 shadow-card select-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{ left: pos.x, top: pos.y, width: 128 }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Header */}
      <p className="font-poppins font-bold text-[10px] uppercase tracking-wide text-forest/40 mb-2 text-center">
        Orientation
      </p>

      {/* SVG Compass */}
      <svg
        width={88}
        height={88}
        viewBox="0 0 88 88"
        className="mx-auto block"
        aria-label="Boussole interactive"
        role="img"
      >
        {/* Background */}
        <circle cx={44} cy={44} r={40} fill="#F9F7E8" stroke="rgba(30,86,49,0.12)" strokeWidth={1.5} />

        {/* Graduation ticks */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 - 90) * (Math.PI / 180)
          const r1 = 34, r2 = 38
          return (
            <line
              key={i}
              x1={44 + r1 * Math.cos(angle)}
              y1={44 + r1 * Math.sin(angle)}
              x2={44 + r2 * Math.cos(angle)}
              y2={44 + r2 * Math.sin(angle)}
              stroke="rgba(30,86,49,0.18)"
              strokeWidth={1}
            />
          )
        })}

        {/* Sun arc */}
        <path d={arcPath} fill="none" stroke="#F6C445" strokeWidth={4} strokeLinecap="round" opacity={0.85} />

        {/* Cardinal labels */}
        {[
          { label: 'N', x: 44, y: 14 },
          { label: 'S', x: 44, y: 78 },
          { label: 'E', x: 78, y: 48 },
          { label: 'O', x: 10, y: 48 },
        ].map(({ label, x, y }) => (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontFamily="Poppins, sans-serif"
            fontWeight="700"
            fill={label === 'N' ? '#e53e3e' : 'rgba(30,86,49,0.45)'}
          >
            {label}
          </text>
        ))}

        {/* Rotating needle */}
        <g transform={`rotate(${needleAngle}, 44, 44)`}>
          {/* North tip (red) */}
          <polygon points="44,16 41,44 47,44" fill="#e53e3e" />
          {/* South tip (gray) */}
          <polygon points="44,72 41,44 47,44" fill="rgba(30,86,49,0.22)" />
        </g>

        {/* Center dot */}
        <circle cx={44} cy={44} r={3} fill="#1E5631" />
      </svg>

      {/* Degree + direction text */}
      <p className="font-poppins font-semibold text-[11px] text-forest text-center mt-1.5">
        {deg}° — {sunDirection}
      </p>

      {/* Sun badge */}
      <div className="flex items-center gap-1 mt-1.5 bg-[#fffbe0] border border-[#F6C445]/30 rounded-lg px-2 py-0.5 justify-center">
        <span className="text-xs" aria-hidden>☀️</span>
        <span className="font-raleway text-[10px] text-forest/70 leading-tight">
          Côté {sunDirection}
        </span>
      </div>

      {/* Rotation buttons */}
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={() => rotate(-15)}
          className="flex-1 py-1 rounded-lg bg-sand hover:bg-lime/20 font-poppins font-bold text-xs text-forest transition-colors"
          aria-label="Tourner vers l'ouest"
          title="Tourner vers l'ouest (−15°)"
        >
          ◁
        </button>
        <button
          onClick={() => rotate(15)}
          className="flex-1 py-1 rounded-lg bg-sand hover:bg-lime/20 font-poppins font-bold text-xs text-forest transition-colors"
          aria-label="Tourner vers l'est"
          title="Tourner vers l'est (+15°)"
        >
          ▷
        </button>
      </div>
    </div>
  )
}
