import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BookMarked, BookOpen, Meh, ThumbsDown, ThumbsUp, X } from 'lucide-react-native'
import {
  SECRET_EVIDENCE_HINTS,
  SECRET_VERDICT_LABELS,
  SECRET_VERDICTS,
  type GardenAction,
  type GardenSecret,
  type SecretVerdict,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'

import { EvidenceBadge } from './EvidenceBadge'
import { SecretRecipe } from './SecretRecipe'

const VERDICT_ICON: Record<SecretVerdict, typeof Meh> = {
  WORKED: ThumbsUp,
  MEH: Meh,
  FAILED: ThumbsDown,
}

export interface SecretSheetProps {
  action: GardenAction | null
  secret: GardenSecret | null
  onClose: () => void
  /** « Je tente » — stage `discover`. */
  onTry: () => void
  /** « Pas pour moi » — stage `discover`. */
  onDismiss: () => void
  /** « C'est fait » — stage `ready`. */
  onReadyDone: () => void
  /** Un verdict — stage `feedback`. */
  onFeedback: (verdict: SecretVerdict) => void
  onOpenGrimoire?: () => void
}

/**
 * Le secret, en feuille montante — dans l'esprit d'`ActionDetailSheet`.
 *
 * Trois moments, trois fins de feuille : dévoiler puis tenter ; s'en servir
 * quand la préparation est prête ; dire si ça a marché. Le niveau de preuve
 * est rappelé avec sa phrase d'explication : c'est ici qu'on décide d'essayer.
 */
export function SecretSheet({
  action,
  secret,
  onClose,
  onTry,
  onDismiss,
  onReadyDone,
  onFeedback,
  onOpenGrimoire,
}: SecretSheetProps) {
  const insets = useSafeAreaInsets()
  if (!action || !secret) return null

  const stage = secret.stage
  const eyebrow =
    stage === 'discover'
      ? 'Secret de jardinier'
      : stage === 'ready'
        ? 'Ta préparation est prête'
        : 'Ça a marché ?'

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-forest/40" onPress={onClose} accessibilityLabel="Fermer" />

      <View
        className="max-h-[88%] rounded-t-3xl bg-sand px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
        accessibilityViewIsModal
      >
        <View className="mb-3 h-1 w-10 self-center rounded-full bg-sand-dark" />

        <View className="mb-3 flex-row items-start gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-sand-dark">
            <BookOpen size={22} color="#1E5631" />
          </View>

          <View className="flex-1 gap-0.5">
            <Text className="font-poppins text-caption uppercase tracking-wider text-muted-foreground">
              {eyebrow}
            </Text>
            <Text className="font-poppins text-section text-forest">{secret.title}</Text>
            {action.plantName ? (
              <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={1}>
                {action.plantEmoji ? `${action.plantEmoji} ` : ''}
                {action.plantName}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center"
          >
            <X size={22} color="#1E5631" />
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="gap-4 pb-4" showsVerticalScrollIndicator={false}>
          <View className="gap-1.5 rounded-xl bg-card p-3">
            <EvidenceBadge evidence={secret.evidence} />
            <Text className="font-raleway text-secondary text-forest">
              {SECRET_EVIDENCE_HINTS[secret.evidence]}
            </Text>
          </View>

          {stage === 'feedback' && action.why ? (
            <Text className="font-raleway text-body text-forest">{action.why}</Text>
          ) : null}

          {stage === 'ready' ? (
            <Text className="font-raleway text-body text-forest">
              {action.why ?? "Ta préparation a eu le temps qu'il lui fallait."} Voici comment
              t&apos;en servir.
            </Text>
          ) : null}

          {stage !== 'feedback' ? (
            <SecretRecipe
              // L'histoire a été lue au dévoilement : à la préparation prête,
              // on va droit au geste.
              story={stage === 'discover' ? secret.story : null}
              ingredients={stage === 'discover' ? secret.ingredients : []}
              recipe={secret.recipe}
              cautions={secret.cautions}
              prepDays={stage === 'discover' ? secret.prepDays : 0}
              effortMinutes={stage === 'discover' ? secret.effortMinutes : null}
            />
          ) : null}

          {onOpenGrimoire ? (
            <Pressable
              onPress={onOpenGrimoire}
              accessibilityRole="link"
              accessibilityLabel="Ouvrir mon grimoire"
              className="h-11 flex-row items-center gap-2 self-start"
              style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
            >
              <BookMarked size={18} color="#1E5631" />
              <Text className="font-raleway-semibold text-secondary text-forest underline">
                Mon grimoire de secrets
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {/* Les choix restent en bas, dans la zone du pouce. */}
        <View className="gap-2 pt-2">
          {stage === 'discover' ? (
            <>
              <Button label="Je tente" size="lg" onPress={onTry} />
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Button label="Plus tard" variant="ghost" onPress={onClose} />
                </View>
                <View className="flex-1">
                  <Button label="Pas pour moi" variant="outline" onPress={onDismiss} />
                </View>
              </View>
            </>
          ) : stage === 'ready' ? (
            <>
              <Button label="C'est fait" size="lg" onPress={onReadyDone} />
              <Button label="Plus tard" variant="ghost" onPress={onClose} />
            </>
          ) : secret.trialCareLogId ? (
            <>
              {SECRET_VERDICTS.map((verdict) => {
                const Icon = VERDICT_ICON[verdict]
                return (
                  <Button
                    key={verdict}
                    label={SECRET_VERDICT_LABELS[verdict]}
                    variant={verdict === 'WORKED' ? 'primary' : 'outline'}
                    icon={<Icon size={20} color="#1E5631" />}
                    onPress={() => onFeedback(verdict)}
                  />
                )
              })}
              <Button label="Plus tard" variant="ghost" onPress={onClose} />
            </>
          ) : (
            // Un serveur qui n'aurait pas rendu l'essai d'origine : on ne
            // propose pas un verdict qui ne saurait à quoi se rattacher.
            <Button label="Fermer" variant="outline" onPress={onClose} />
          )}
        </View>
      </View>
    </Modal>
  )
}
