import { cn } from '@/lib/utils'

const DROP = 'M12 2.5 C 9 7.5, 5.5 10.8, 5.5 15 a6.5 6.5 0 0 0 13 0 c0-4.2-3.5-7.5-6.5-12.5z'
const VEINS = 'M12 12.5 v6.5 M12 16 l-2.6 -2.2 M12 14.6 l2.6 -2.2'

/**
 * La goutte de sève — même tracé que l'app mobile (`components/sap/SapDrop`)
 * et que les maquettes « Growi — La Sève ». Toute retouche se reporte des deux
 * côtés. Toujours décorative : le texte voisin dit ce qu'elle compte.
 */
export function SapDrop({
  size = 24,
  empty = false,
  veins = size >= 20,
  onDark = false,
  className,
}: {
  size?: number
  /** Une goutte déjà offerte : le contour seul. */
  empty?: boolean
  veins?: boolean
  /** Contour sand, pour un fond forest. */
  onDark?: boolean
  className?: string
}) {
  const stroke = onDark ? '#F9F7E8' : '#1E5631'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <path
        d={DROP}
        fill={empty ? 'none' : '#B4DD7F'}
        stroke={stroke}
        strokeOpacity={empty ? 0.45 : 1}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {veins && !empty ? (
        <path d={VEINS} fill="none" stroke="#1E5631" strokeWidth={1.6} strokeLinecap="round" />
      ) : null}
    </svg>
  )
}

/** La goutte au trait, en `currentColor` — pour la navigation, comme les icônes lucide. */
export function SapDropIcon({ size = 24, className }: { size?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={DROP} />
      <path d={VEINS} strokeWidth={1.6} />
    </svg>
  )
}

/** Les gouttes de la semaine : pleines celles qui restent, au trait celles offertes. */
export function GiftDrops({ left, perWeek, size = 18 }: { left: number; perWeek: number; size?: number }) {
  return (
    <span className="inline-flex shrink-0 gap-0.5" aria-hidden="true">
      {Array.from({ length: perWeek }, (_, index) => (
        <SapDrop key={index} size={size} empty={index >= left} veins={false} />
      ))}
    </span>
  )
}
