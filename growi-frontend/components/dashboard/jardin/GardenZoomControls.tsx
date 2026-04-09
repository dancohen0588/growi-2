// growi-frontend/components/dashboard/jardin/GardenZoomControls.tsx

interface GardenZoomControlsProps {
  zoom: number
  onZoom: (zoom: number) => void
}

const STEP = 0.1
const MIN = 0.4
const MAX = 2.0

export function GardenZoomControls({ zoom, onZoom }: GardenZoomControlsProps) {
  const clamp = (v: number) => Math.min(MAX, Math.max(MIN, parseFloat(v.toFixed(1))))

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center bg-white border border-border rounded-xl shadow-sm overflow-hidden select-none">
      <button
        onClick={() => onZoom(clamp(zoom - STEP))}
        disabled={zoom <= MIN}
        title="Zoom arrière"
        aria-label="Zoom arrière"
        className="px-3 py-1.5 font-poppins text-xs font-bold text-forest border-r border-forest/10 hover:bg-sand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        −
      </button>
      <span className="px-3 py-1.5 font-poppins text-xs font-semibold text-forest/60 w-14 text-center" aria-label="Niveau de zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoom(clamp(zoom + STEP))}
        disabled={zoom >= MAX}
        title="Zoom avant"
        aria-label="Zoom avant"
        className="px-3 py-1.5 font-poppins text-xs font-bold text-forest border-l border-r border-forest/10 hover:bg-sand disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        +
      </button>
      <button
        onClick={() => onZoom(1)}
        title="Réinitialiser le zoom"
        aria-label="Réinitialiser le zoom"
        className="px-3 py-1.5 font-poppins text-xs font-bold text-forest hover:bg-sand transition-colors"
      >
        ⟳
      </button>
    </div>
  )
}
