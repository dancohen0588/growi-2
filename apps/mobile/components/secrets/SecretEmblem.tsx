import { View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { SECRET_EMBLEM_SVG, type SecretEmblemVariant } from '@growi/shared'

export interface SecretEmblemProps {
  /**
   * `full` dès 40 pt (carte, planche, grimoire), `small` de 20 à 40 pt,
   * `line` au trait pour la navigation — voir `SECRET_EMBLEM_SVG`.
   */
  variant?: SecretEmblemVariant
  size?: number
  /** Couleur du trait, pour `line` seulement (`currentColor`). */
  color?: string
  /**
   * Décoratif par défaut : posé à côté d'un titre qui dit déjà « secret », il
   * ne ferait que répéter. Donner un libellé le rend lisible au lecteur d'écran.
   */
  accessibilityLabel?: string
}

/**
 * L'emblème des secrets de jardinier : un sceau soleil, une serrure d'où sort
 * une pousse. Réservé aux secrets — aucune autre carte du planning ne le porte.
 */
export function SecretEmblem({
  variant = 'full',
  size = 48,
  color = '#1E5631',
  accessibilityLabel,
}: SecretEmblemProps) {
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!accessibilityLabel}
    >
      <SvgXml xml={SECRET_EMBLEM_SVG[variant]} width={size} height={size} color={color} />
    </View>
  )
}
