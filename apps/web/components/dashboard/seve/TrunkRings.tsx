/**
 * La coupe du tronc — même dessin que l'app mobile
 * (`apps/mobile/components/sap/TrunkRings.tsx`) : toute retouche se reporte
 * des deux côtés. Un cerne par palier franchi, celui qui se forme en
 * pointillé, rempli à mesure ; les cernes sont légèrement décentrés et
 * ovales, de façon déterministe, pour avoir l'air de bois et non d'une cible.
 */

const FOREST = '#1E5631'
const FOREST_LIGHT = '#2d7a47'
const LIME = '#B4DD7F'
const SAND = '#F9F7E8'
const SUN = '#F6C445'
const SUN_PRESSED = '#e4b030'

const MAX_DRAWN_RINGS = 8
const CENTER = 120
const BARK_R = 104
const WOOD_R = 96
const CURRENT_R = 82
const CORE_R = 6
const OUTER_R = 112

function dash(r: number, progress: number): string {
  const circumference = 2 * Math.PI * r
  return `${Math.max(0, Math.min(1, progress)) * circumference} ${circumference}`
}

export function TrunkRings({
  count,
  progress,
  size,
  halo = false,
  label,
  className,
}: {
  count: number
  progress: number
  size: number
  /** Sur un fond forest : un anneau lime autour de l'écorce redit l'avancement. */
  halo?: boolean
  label: string
  className?: string
}) {
  const drawn = Math.min(count, MAX_DRAWN_RINGS)
  const inner = CURRENT_R - 10
  const rings = Array.from({ length: drawn }, (_, index) => {
    const i = index + 1
    const r = CORE_R + 6 + ((inner - CORE_R - 6) * i) / (drawn + 0.5)
    const wobble = i % 2 === 0 ? 0.8 : -0.8
    return { i, rx: r + wobble, ry: r - wobble, cx: CENTER + ((i % 3) - 1) * 0.7 }
  })

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={halo ? '0 0 240 240' : '14 14 212 212'}
      className={className}
    >
      {halo ? (
        <>
          <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="none" stroke={LIME} strokeOpacity={0.22} strokeWidth={8} />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R}
            fill="none"
            stroke={LIME}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={dash(OUTER_R, progress)}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        </>
      ) : null}
      <circle cx={CENTER} cy={CENTER} r={BARK_R} fill={FOREST} />
      <circle cx={CENTER} cy={CENTER} r={BARK_R} fill="#000000" fillOpacity={0.28} />
      <circle cx={CENTER} cy={CENTER} r={WOOD_R} fill={SAND} />
      <circle cx={CENTER} cy={CENTER} r={WOOD_R} fill={SUN} fillOpacity={0.42} />
      <circle cx={CENTER} cy={CENTER} r={CURRENT_R} fill="none" stroke={SUN_PRESSED} strokeWidth={2.5} strokeDasharray="3 6" />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={CURRENT_R}
        fill="none"
        stroke={FOREST_LIGHT}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeDasharray={dash(CURRENT_R, progress)}
        transform={`rotate(-90 ${CENTER} ${CENTER})`}
      />
      {rings.map((ring) => (
        <ellipse
          key={ring.i}
          cx={ring.cx}
          cy={CENTER}
          rx={ring.rx}
          ry={ring.ry}
          fill="none"
          stroke={FOREST}
          strokeOpacity={0.6}
          strokeWidth={2.6}
        />
      ))}
      <circle cx={CENTER} cy={CENTER} r={CORE_R} fill={FOREST} />
    </svg>
  )
}

/** L'avancement du cerne en cours, en barre — décoratif, le texte voisin le dit. */
export function SapProgressBar({ progress, onDark = false }: { progress: number; onDark?: boolean }) {
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <span
      aria-hidden="true"
      className={`block h-2 overflow-hidden rounded-full ${onDark ? 'bg-sand/20' : 'bg-sand-dark'}`}
    >
      <span
        className={`block h-2 rounded-full ${onDark ? 'bg-lime' : 'bg-forest-light'}`}
        style={{ width: `${percent}%` }}
      />
    </span>
  )
}
