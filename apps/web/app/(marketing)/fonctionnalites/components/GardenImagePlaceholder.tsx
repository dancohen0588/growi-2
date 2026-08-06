import { cn } from '@/lib/utils'

interface GardenImagePlaceholderProps {
  variant: 'cartographie' | 'assistant' | 'diagnostic' | 'calendrier' | 'marketplace'
  className?: string
}

const variantConfig: Record<
  GardenImagePlaceholderProps['variant'],
  { bg: string; accent: string; icon: string; label: string; prompt: string }
> = {
  cartographie: {
    bg: 'from-forest/10 to-lime/20',
    accent: 'bg-forest',
    icon: '🗺️',
    label: 'Aperçu cartographie du jardin',
    prompt: 'Carte illustrée du jardin avec zones colorées',
  },
  assistant: {
    bg: 'from-lime/20 to-sand',
    accent: 'bg-lime',
    icon: '🤖',
    label: "Aperçu de l'assistant IA",
    prompt: "Interface de l'assistant intelligent",
  },
  diagnostic: {
    bg: 'from-sun/20 to-lime/10',
    accent: 'bg-sun',
    icon: '🔬',
    label: 'Aperçu diagnostic IA maladies',
    prompt: 'Diagnostic photo avec cercles de détection',
  },
  calendrier: {
    bg: 'from-forest/10 to-sun/10',
    accent: 'bg-forest',
    icon: '📅',
    label: 'Aperçu calendrier potager',
    prompt: 'Calendrier potager avec tâches illustrées',
  },
  marketplace: {
    bg: 'from-lime/10 to-sand',
    accent: 'bg-lime',
    icon: '🛍️',
    label: 'Aperçu marketplace services',
    prompt: 'Marketplace de services jardinage',
  },
}

export function GardenImagePlaceholder({
  variant,
  className,
}: GardenImagePlaceholderProps) {
  const config = variantConfig[variant]

  return (
    <div
      role="img"
      aria-label={config.label}
      className={cn(
        'relative rounded-3xl overflow-hidden',
        'bg-gradient-to-br',
        config.bg,
        'aspect-[4/3] w-full',
        'flex flex-col items-center justify-center gap-4',
        'border border-forest/10 shadow-card',
        className
      )}
    >
      {/* Decorative circles */}
      <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-white/30 blur-xl" aria-hidden="true" />
      <div className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-white/20 blur-lg" aria-hidden="true" />

      {/* Icon badge */}
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-card',
          config.accent,
          'bg-opacity-20'
        )}
        aria-hidden="true"
      >
        {config.icon}
      </div>

      {/* Label */}
      <p className="font-raleway text-sm text-forest/50 px-4 text-center" aria-hidden="true">
        {config.prompt}
      </p>

      {/* Corner badge */}
      <span aria-hidden="true" className="absolute top-3 left-3 bg-white/80 text-forest text-xs font-poppins font-semibold px-2 py-1 rounded-full">
        Aperçu
      </span>
    </div>
  )
}
