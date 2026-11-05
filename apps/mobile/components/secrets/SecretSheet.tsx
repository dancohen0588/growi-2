import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BookMarked, Check, Meh, ThumbsDown, ThumbsUp, X } from 'lucide-react-native'
import {
  SECRET_EVIDENCE_HINTS,
  SECRET_VERDICT_LABELS,
  SECRET_VERDICTS,
  type GardenAction,
  type GardenSecret,
  type SecretStage,
  type SecretVerdict,
} from '@growi/shared'

import { Button } from '@/components/ui/Button'

import { EvidenceBadge } from './EvidenceBadge'
import { SecretEmblem } from './SecretEmblem'
import { SecretPlanche } from './SecretPlanche'
import { SecretRecipe } from './SecretRecipe'

const VERDICT_ICON: Record<SecretVerdict, typeof Meh> = {
  WORKED: ThumbsUp,
  MEH: Meh,
  FAILED: ThumbsDown,
}

const EYEBROW: Record<SecretStage, string> = {
  discover: 'Secret de jardinier',
  ready: 'Ta préparation est prête',
  feedback: 'Ça a marché ?',
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

/** Un choix secondaire en lien souligné — « Pas pour moi ». */
function LinkChoice({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-11 flex-1 items-center justify-center px-2"
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
    >
      <Text className="text-center font-poppins text-body text-muted-foreground underline">
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Les choix, fixés en bas de la feuille dans la zone du pouce. Le geste
 * principal est plein, en forest, avec le relief des boutons de la planche.
 */
function SheetActions({
  secret,
  onClose,
  onTry,
  onDismiss,
  onReadyDone,
  onFeedback,
}: Omit<SecretSheetProps, 'action' | 'secret' | 'onOpenGrimoire'> & { secret: GardenSecret }) {
  const stage = secret.stage
  const check = <Check size={20} color="#B4DD7F" strokeWidth={2.4} />

  if (stage === 'discover') {
    return (
      <>
        <Button
          label="Je tente"
          variant="forest"
          size="lg"
          font="poppins-bold"
          raised
          icon={check}
          onPress={onTry}
        />
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <Button label="Plus tard" variant="outline" font="poppins" onPress={onClose} />
          </View>
          <LinkChoice label="Pas pour moi" onPress={onDismiss} />
        </View>
      </>
    )
  }

  if (stage === 'ready') {
    return (
      <>
        <Button
          label="C'est fait"
          variant="forest"
          size="lg"
          font="poppins-bold"
          raised
          icon={check}
          onPress={onReadyDone}
        />
        <Button label="Plus tard" variant="outline" font="poppins" onPress={onClose} />
      </>
    )
  }

  // Un serveur qui n'aurait pas rendu l'essai d'origine : on ne propose pas un
  // verdict qui ne saurait à quoi se rattacher.
  if (!secret.trialCareLogId) {
    return <Button label="Fermer" variant="outline" font="poppins" onPress={onClose} />
  }

  return (
    <>
      {SECRET_VERDICTS.map((verdict) => {
        const Icon = VERDICT_ICON[verdict]
        const main = verdict === 'WORKED'
        return (
          <Button
            key={verdict}
            label={SECRET_VERDICT_LABELS[verdict]}
            variant={main ? 'forest' : 'outline'}
            font={main ? 'poppins-bold' : 'poppins'}
            raised={main}
            icon={<Icon size={20} color={main ? '#B4DD7F' : '#1E5631'} />}
            onPress={() => onFeedback(verdict)}
          />
        )
      })}
      <View className="flex-row">
        <LinkChoice label="Plus tard" onPress={onClose} />
      </View>
    </>
  )
}

/**
 * Le secret, en feuille montante — dans l'esprit d'`ActionDetailSheet`.
 *
 * Trois moments, trois fins de feuille : dévoiler puis tenter ; s'en servir
 * quand la préparation est prête ; dire si ça a marché.
 *
 * **Avec une planche** (maquette Claude Design `MobilePlanche.dc`) : emblème,
 * badge et titre en tête, le récit en encadré soleil, les cases empilées, la
 * précaution sur fond forest. **Sans planche** : le texte d'avant — histoire,
 * ingrédients, recette, précautions —, l'emblème à la place de l'icône.
 *
 * Le niveau de preuve est rappelé avec sa phrase d'explication dans les deux
 * cas : c'est ici qu'on décide d'essayer.
 */
export function SecretSheet(props: SecretSheetProps) {
  const { action, secret, onClose, onOpenGrimoire } = props
  const insets = useSafeAreaInsets()
  if (!action || !secret) return null

  const stage = secret.stage
  const planche = secret.planche ?? null
  const footerPadding = { paddingBottom: Math.max(insets.bottom, 16) + 8 }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-forest/40" onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />

      {planche ? (
        <View className="max-h-[92%] rounded-t-3xl bg-card" accessibilityViewIsModal>
          <View className="mb-2 mt-3 h-1.5 w-11 self-center rounded-full bg-sand-dark" />

          <ScrollView
            contentContainerClassName="gap-4 px-4 pb-5 pt-2"
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-center gap-3.5">
              <SecretEmblem size={60} />
              <View className="flex-1 gap-1.5">
                <EvidenceBadge
                  evidence={secret.evidence}
                  tone="sun"
                  suffix={secret.effortMinutes ? `${secret.effortMinutes} min` : undefined}
                />
                <Text
                  className="font-poppins-bold text-forest"
                  style={{ fontSize: 22, lineHeight: 27 }}
                  accessibilityRole="header"
                >
                  {secret.title}
                </Text>
                {stage !== 'discover' ? (
                  <Text className="font-poppins text-caption uppercase tracking-wider text-muted-foreground">
                    {EYEBROW[stage]}
                  </Text>
                ) : null}
              </View>
            </View>

            <Text className="font-raleway text-secondary text-muted-foreground">
              {action.plantName
                ? `${action.plantEmoji ? `${action.plantEmoji} ` : ''}${action.plantName} · `
                : ''}
              {SECRET_EVIDENCE_HINTS[secret.evidence]}
            </Text>

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
              <SecretPlanche
                planche={planche}
                // L'histoire a été lue au dévoilement : à la préparation prête,
                // on va droit au geste.
                story={stage === 'discover' ? secret.story : null}
              />
            ) : null}

            {stage === 'discover' && secret.prepDays > 0 ? (
              <Text className="font-raleway-medium text-secondary text-forest">
                ⏳ Prêt dans {secret.prepDays} jour{secret.prepDays > 1 ? 's' : ''} : on te fait
                signe quand ce sera le moment.
              </Text>
            ) : null}
          </ScrollView>

          <View className="gap-2.5 border-t border-sand-dark bg-card px-4 pt-3.5" style={footerPadding}>
            <SheetActions {...props} secret={secret} />
          </View>
        </View>
      ) : (
        <View
          className="max-h-[88%] rounded-t-3xl bg-sand px-4 pt-3"
          style={footerPadding}
          accessibilityViewIsModal
        >
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-sand-dark" />

          <View className="mb-3 flex-row items-start gap-3">
            <SecretEmblem size={48} />

            <View className="flex-1 gap-0.5">
              <Text className="font-poppins text-caption uppercase tracking-wider text-muted-foreground">
                {EYEBROW[stage]}
              </Text>
              <Text className="font-poppins text-section text-forest" accessibilityRole="header">
                {secret.title}
              </Text>
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
            <SheetActions {...props} secret={secret} />
          </View>
        </View>
      )}
    </Modal>
  )
}
