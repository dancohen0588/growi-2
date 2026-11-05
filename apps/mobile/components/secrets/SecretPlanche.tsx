import { Text, View } from 'react-native'
import { isSecretArt, type SecretPanel, type SecretPlanche as Planche } from '@growi/shared'

import { SecretArt } from './SecretArt'

/**
 * Les teintes des cases alternent, soleil puis lime, comme sur la maquette.
 * Ce sont les tokens à opacité réduite posés sur le fond `card` de la feuille
 * (≈ `#FCE7A9` et `#DCEFC0` du registre de dessins) — pas de couleur de plus.
 */
const PANEL_TINTS = ['bg-sun/40', 'bg-lime/50'] as const

/** La légende, avec son passage en gras (`emphasis`, recopié tel quel). */
function Caption({ panel }: { panel: SecretPanel }) {
  const { caption, emphasis } = panel
  const at = emphasis ? caption.indexOf(emphasis) : -1

  return (
    <Text className="font-raleway-medium text-body leading-[22px] text-forest">
      {at < 0 || !emphasis ? (
        caption
      ) : (
        <>
          {caption.slice(0, at)}
          <Text className="font-raleway-bold">{emphasis}</Text>
          {caption.slice(at + emphasis.length)}
        </>
      )}
    </Text>
  )
}

/** Un encadré au trait épais, avec l'ombre décalée pleine d'une case de BD. */
function StoryBox({ story }: { story: string }) {
  return (
    // La marge droite et basse laisse la place à l'ombre décalée.
    <View className="mb-1 mr-1.5">
      <View
        className="absolute bottom-0 left-0 right-0 top-0 rounded bg-forest"
        style={{ transform: [{ translateX: 5 }, { translateY: 5 }] }}
      />
      <View className="rounded border-[3px] border-forest bg-sun px-3.5 py-3">
        <Text className="font-raleway-medium text-body italic leading-[22px] text-forest">
          {story}
        </Text>
      </View>
    </View>
  )
}

function PanelCase({ panel, index }: { panel: SecretPanel; index: number }) {
  // Sans dessin, la légende descend sous le numéro au lieu de passer dessous.
  const hasArt = isSecretArt(panel.art)

  return (
    // Une case se lit d'un bloc : « Étape 1 : … ». Le dessin, dont le texte
    // alternatif est la même légende, n'est pas relu une seconde fois.
    <View
      className={`overflow-hidden rounded-md border-4 border-forest ${
        PANEL_TINTS[index % PANEL_TINTS.length]
      } ${hasArt ? '' : 'pt-14'}`}
      accessible
      accessibilityLabel={`Étape ${index + 1} : ${panel.caption}`}
    >
      <SecretArt artKey={panel.art} label={panel.caption} />

      {/* Le numéro, par-dessus le dessin. Taille fixe : c'est un repère, et
          agrandi il masquerait le dessin. */}
      <View className="absolute left-2 top-2 h-9 w-9 items-center justify-center rounded-full bg-forest">
        <Text className="font-poppins-bold text-section text-sun" allowFontScaling={false}>
          {index + 1}
        </Text>
      </View>

      <View className="mx-2.5 mb-2.5 rounded border-[3px] border-forest bg-white px-3 py-2.5">
        <Caption panel={panel} />
      </View>
    </View>
  )
}

export interface SecretPlancheProps {
  planche: Planche
  /** Le récit, en encadré soleil. Omis quand il a déjà été lu (préparation prête). */
  story?: string | null
}

/**
 * La planche d'un secret : le récit en encadré, les cases empilées (dessin et
 * légende), puis la précaution sur fond forest. Partagée par la feuille du
 * planning et le grimoire, pour qu'un secret se lise pareil aux deux endroits.
 *
 * Une case dont le dessin manque à cette version de l'app garde sa légende :
 * l'étape compte plus que l'image.
 */
export function SecretPlanche({ planche, story }: SecretPlancheProps) {
  const caution = planche.caution

  return (
    <View className="gap-4">
      {story ? <StoryBox story={story} /> : null}

      {planche.panels.map((panel, index) => (
        <PanelCase key={`${panel.art}-${index}`} panel={panel} index={index} />
      ))}

      {caution ? (
        <View
          className="flex-row items-center gap-3.5 rounded-md bg-forest px-4 py-3.5"
          accessible
          accessibilityLabel={`Précaution : ${caution.title} ${caution.text}`}
        >
          {isSecretArt(caution.art) ? (
            <SecretArt artKey={caution.art} label={caution.title} width={96} />
          ) : null}
          <View className="flex-1 gap-1">
            <Text className="font-poppins-bold text-body text-sand">{caution.title}</Text>
            <Text className="font-raleway text-secondary text-lime">{caution.text}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
