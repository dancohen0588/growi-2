import { View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { SECRET_ART, isCautionArt, isSecretArt } from '@growi/shared'

/**
 * Les `<text>` des dessins (onomatopées, bulles) sont écrits en
 * `font-family="Poppins"` + `font-weight` 700/800 pour le web. Sur mobile, la
 * famille doit être le **nom exact** de la police chargée par `app/_layout.tsx`,
 * sinon le texte retombe sur la police système. La graisse est retirée : le
 * fichier chargé est déjà le gras, et iOS chercherait sinon une variante 800
 * qu'il n'a pas — retour à la police système, là encore.
 */
const APP_BOLD_FONT = 'Poppins_700Bold'

const prepared = new Map<string, string>()

function mobileXml(key: string): string {
  const cached = prepared.get(key)
  if (cached) return cached
  const xml = SECRET_ART[key]
    .replace(/font-family="Poppins"/g, `font-family="${APP_BOLD_FONT}"`)
    .replace(/\sfont-weight="\d+"/g, '')
  prepared.set(key, xml)
  return xml
}

export interface SecretArtProps {
  /** Clé du registre `SECRET_ART` (`eau-cuisson/1`). */
  artKey: string
  /**
   * Le texte alternatif. Absent : dessin décoratif — c'est le cas dans la
   * planche, où la légende écrite dessous le dit déjà ; la répéter la ferait
   * lire deux fois.
   */
  label?: string
  /**
   * Largeur imposée, pour la précaution posée à côté de son texte. Sans elle,
   * le dessin prend toute la largeur disponible.
   */
  width?: number
}

/**
 * Un dessin de planche. Une clé inconnue ne rend **rien** : la base ne porte que
 * des clés, et une planche plus récente que l'app ne doit pas laisser de trou.
 * Les proportions viennent du registre — cases en 320 × 240, précautions en
 * 220 × 130.
 */
export function SecretArt({ artKey, label, width }: SecretArtProps) {
  if (!isSecretArt(artKey)) return null

  const ratio = isCautionArt(artKey) ? 220 / 130 : 320 / 240

  return (
    <View
      style={width ? { width, aspectRatio: ratio } : { width: '100%', aspectRatio: ratio }}
      {...(label
        ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
        : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const })}
    >
      <SvgXml xml={mobileXml(artKey)} width="100%" height="100%" />
    </View>
  )
}
