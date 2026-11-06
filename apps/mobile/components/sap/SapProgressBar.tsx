import { View } from 'react-native'

export interface SapProgressBarProps {
  progress: number
  /** Sur le bloc forest : piste translucide et remplissage lime. */
  onDark?: boolean
}

/** L'avancement du cerne en cours, en barre — décoratif, le texte voisin le dit. */
export function SapProgressBar({ progress, onDark = false }: SapProgressBarProps) {
  const percent = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` as const

  return (
    <View
      accessible={false}
      className={`h-2 overflow-hidden rounded-full ${onDark ? 'bg-sand/20' : 'bg-sand-dark'}`}
    >
      <View
        className={`h-2 rounded-full ${onDark ? 'bg-lime' : 'bg-forest-light'}`}
        style={{ width: percent }}
      />
    </View>
  )
}
