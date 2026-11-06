import { Modal, Pressable, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { sapRingOrdinal, type SapRings } from '@growi/shared'

import { Button } from '@/components/ui/Button'
import { ringsLabel } from '@/lib/sap'

import { SapProgressBar } from './SapProgressBar'
import { TrunkRings } from './TrunkRings'

const FOREST = '#1E5631'
const LIME = '#B4DD7F'
const SAND = '#F9F7E8'
const SUN = '#F6C445'

/**
 * Les deux « grands moments » de la sève, en feuille montante : un retour sur
 * un Secret (+5), et un cerne formé. Tout autre gain se dit d'un toast — une
 * feuille à chaque arrosage deviendrait vite ce qu'on ferme sans lire.
 */
export type SapMoment =
  | { kind: 'secret'; amount: number; label: string; total: number; rings: SapRings }
  | { kind: 'ring'; total: number; rings: SapRings }

export interface SapMomentSheetProps {
  moment: SapMoment | null
  onClose: () => void
  onOpenSeve: () => void
}

/** La goutte qui rayonne, avec son « +5 » en étiquette posée de biais. */
function RadiantDrop({ amount }: { amount: number }) {
  return (
    <View style={{ width: 200, height: 170 }}>
      <Svg width={200} height={170} viewBox="0 0 200 170" accessible={false}>
        <Path
          d="M100 18 l0 -14 M146 34 l10 -10 M54 34 l-10 -10 M168 78 l14 0 M32 78 l-14 0"
          stroke={SUN}
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Path
          d="M100 30 C 82 62, 56 84, 56 114 a44 44 0 0 0 88 0 c0 -30 -26 -52 -44 -84 z"
          fill={LIME}
          stroke={FOREST}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <Path
          d="M100 98 v48 M100 122 l-18 -15 M100 112 l18 -15"
          fill="none"
          stroke={FOREST}
          strokeWidth={4.5}
          strokeLinecap="round"
        />
        <Path
          d="M76 104 c 2 -12, 8 -20, 14 -28"
          fill="none"
          stroke={SAND}
          strokeWidth={5}
          strokeLinecap="round"
          strokeOpacity={0.8}
        />
      </Svg>
      <View
        className="absolute rounded-md border-[3px] border-forest bg-sun px-3 py-0.5"
        style={{
          right: -6,
          top: 26,
          transform: [{ rotate: '8deg' }],
          shadowColor: FOREST,
          shadowOpacity: 1,
          shadowRadius: 0,
          shadowOffset: { width: 4, height: 4 },
          elevation: 4,
        }}
      >
        <Text className="font-poppins-bold text-forest" style={{ fontSize: 26, lineHeight: 34 }}>
          +{amount}
        </Text>
      </View>
    </View>
  )
}

export function SapMomentSheet({ moment, onClose, onOpenSeve }: SapMomentSheetProps) {
  if (!moment) return null

  const title = moment.kind === 'secret' ? 'Merci pour ton retour !' : `Ton ${sapRingOrdinal(moment.rings.count)} cerne est formé`

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-forest/60" onPress={onClose} accessibilityLabel="Fermer" />

      <View
        className="items-center gap-4 rounded-t-3xl bg-card px-5 pb-10 pt-3"
        accessibilityViewIsModal
        accessibilityLabel={title}
      >
        <View className="h-1 w-11 rounded-full bg-sand-dark" />

        {moment.kind === 'secret' ? (
          <RadiantDrop amount={moment.amount} />
        ) : (
          <TrunkRings
            count={moment.rings.count}
            progress={0}
            size={170}
            label={ringsLabel({ ...moment.rings, progress: 0 })}
          />
        )}

        <View className="items-center gap-2">
          {moment.kind === 'ring' ? (
            <View className="rounded-full bg-forest px-2.5 py-1">
              <Text className="font-raleway-bold text-caption tracking-wide text-lime">
                {moment.rings.floor} DE SÈVE
              </Text>
            </View>
          ) : null}
          <Text className="text-center font-poppins-bold text-forest" style={{ fontSize: 22, lineHeight: 28 }}>
            {title}
          </Text>
          <Text className="text-center font-raleway text-body text-forest-light">
            {moment.kind === 'secret'
              ? `${moment.label} est noté dans ton grimoire. Chaque retour aide à démêler les astuces qui marchent des légendes.`
              : 'Des semaines de soins et de partage, gravées dans ton tronc.'}
          </Text>
        </View>

        {moment.kind === 'secret' ? (
          <View className="w-full flex-row items-center gap-3 rounded-xl border border-sand-dark bg-sand px-3.5 py-3">
            <Text className="font-poppins-bold text-section text-forest">{moment.total}</Text>
            <View className="flex-1 gap-1.5">
              <Text className="font-raleway-medium text-caption text-muted-foreground">
                de sève · ton {sapRingOrdinal(moment.rings.count + 1)} cerne à {Math.round(moment.rings.progress * 100)} %
              </Text>
              <SapProgressBar progress={moment.rings.progress} />
            </View>
          </View>
        ) : null}

        <View className="w-full gap-2.5">
          <Button
            label="Voir ma sève"
            variant="forest"
            size="lg"
            font="poppins-bold"
            raised
            onPress={onOpenSeve}
          />
          <Button label="Continuer" variant="outline" font="poppins" onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}
