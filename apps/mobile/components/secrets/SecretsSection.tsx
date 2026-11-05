import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { BookMarked } from 'lucide-react-native'
import { SECRET_RULE_IDS, type SecretVerdict } from '@growi/shared'

import { useToast } from '@/components/ui/Toast'
import { useTrack } from '@/lib/analytics/posthog'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, type PlanningTask } from '@/lib/queries/planning'
import { useDismissSecret, useRevealSecret, useSecretFeedback } from '@/lib/queries/secrets'

import { SecretCard } from './SecretCard'
import { SecretSheet } from './SecretSheet'

/**
 * `tip_shown` part **une fois par carte et par lancement** de l'app : l'écran
 * se redessine à chaque geste, et l'onglet se remonte au retour. L'identifiant
 * d'action porte la semaine (ou l'essai), donc un nouveau secret repart.
 */
const shownThisSession = new Set<string>()

export interface SecretsSectionProps {
  secrets: PlanningTask[]
  showGardenNames: boolean
  onOpenGrimoire: () => void
}

/**
 * Les secrets de jardinier du planning — cartes, feuille et gestes.
 *
 * Autonome pour pouvoir se poser en tête du calendrier comme, demain, sur
 * l'accueil : l'écran hôte n'a qu'à lui passer les actions qui portent un
 * `secret` (`usePlanningTasks().secrets`). Rien n'est rendu sans secret, ce
 * qui couvre aussi un serveur qui n'en envoie pas.
 */
export function SecretsSection({ secrets, showGardenNames, onOpenGrimoire }: SecretsSectionProps) {
  const toast = useToast()
  const track = useTrack()
  const markDone = useMarkActionDone()
  const reveal = useRevealSecret()
  const dismiss = useDismissSecret()
  const feedback = useSecretFeedback()
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    for (const { action } of secrets) {
      if (!action.secret || shownThisSession.has(action.id)) continue
      shownThisSession.add(action.id)
      track('tip_shown', {
        slug: action.secret.slug,
        evidence: action.secret.evidence,
        stage: action.secret.stage,
      })
    }
  }, [secrets, track])

  const open = secrets.find((task) => task.action.id === openId) ?? null
  const secret = open?.action.secret ?? null

  if (secrets.length === 0) return null

  const openSecret = (task: PlanningTask) => {
    setOpenId(task.action.id)
    // Dévoiler, c'est l'ouvrir. Idempotent : le rouvrir ne coûte rien, et un
    // échec n'empêche pas de lire — la prochaine ouverture le rattrape.
    if (task.action.secret?.stage === 'discover') reveal.mutate(task.action.secret.slug)
  }

  const close = () => setOpenId(null)

  const tryIt = () => {
    if (!open || !secret) return
    const { action, gardenId } = open
    close()
    markDone.mutate(
      {
        actionId: action.id,
        gardenId,
        actionType: 'autre',
        plantId: action.plantId,
        ruleId: SECRET_RULE_IDS.discover,
        tipSlug: secret.slug,
      },
      {
        onSuccess: () =>
          toast(
            secret.prepDays > 0
              ? `C'est lancé ! On te fait signe dans ${secret.prepDays} jour${
                  secret.prepDays > 1 ? 's' : ''
                }, quand ce sera prêt 🫙`
              : 'Bien noté ! On te demandera dans une semaine si ça a marché 🌱',
          ),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const readyDone = () => {
    if (!open || !secret) return
    const { action, gardenId } = open
    close()
    markDone.mutate(
      {
        actionId: action.id,
        gardenId,
        actionType: 'autre',
        plantId: action.plantId,
        ruleId: SECRET_RULE_IDS.ready,
        tipSlug: secret.slug,
      },
      {
        onSuccess: () => toast('Bien noté ! On te demandera dans une semaine si ça a marché 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const notForMe = () => {
    if (!open || !secret) return
    const { action } = open
    close()
    dismiss.mutate(
      { slug: secret.slug, actionId: action.id },
      {
        onSuccess: () => toast('Compris, on ne te le reproposera plus. Il reste dans ton grimoire.'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const answer = (verdict: SecretVerdict) => {
    if (!open || !secret?.trialCareLogId) return
    const { action } = open
    close()
    feedback.mutate(
      { careLogId: secret.trialCareLogId, verdict, actionId: action.id, plantId: action.plantId },
      {
        onSuccess: () => toast('Merci ! Ton retour est noté dans ton grimoire 📖'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  return (
    <View className="gap-2 px-4">
      <View className="flex-row items-center">
        <Text className="flex-1 font-poppins text-section text-forest">
          {secrets.length > 1 ? 'Secrets de jardinier' : 'Secret de jardinier'}
        </Text>
        <Pressable
          onPress={onOpenGrimoire}
          accessibilityRole="link"
          accessibilityLabel="Ouvrir mon grimoire"
          hitSlop={8}
          className="h-11 flex-row items-center gap-1.5 px-1"
          style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}
        >
          <BookMarked size={16} color="#1E5631" />
          <Text className="font-raleway-semibold text-secondary text-forest">Mon grimoire</Text>
        </Pressable>
      </View>

      <View className="gap-3">
        {secrets.map((task) =>
          task.action.secret ? (
            <SecretCard
              key={task.action.id}
              action={task.action}
              secret={task.action.secret}
              gardenName={showGardenNames ? task.gardenName : undefined}
              onOpen={() => openSecret(task)}
            />
          ) : null,
        )}
      </View>

      <SecretSheet
        action={open?.action ?? null}
        secret={secret}
        onClose={close}
        onTry={tryIt}
        onDismiss={notForMe}
        onReadyDone={readyDone}
        onFeedback={answer}
        onOpenGrimoire={() => {
          close()
          onOpenGrimoire()
        }}
      />
    </View>
  )
}
