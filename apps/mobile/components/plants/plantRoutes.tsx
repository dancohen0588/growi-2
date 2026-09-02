import { useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { chatActionSnapshotSchema, type OpenConversationInput } from '@growi/shared'

import { ChatScreen } from '@/components/chat/ChatScreen'
import { DiagnosisScreen } from '@/components/diagnosis/DiagnosisScreen'
import { PlantDetail } from '@/components/plants/PlantDetail'
import { PlantEditor } from '@/components/plants/PlantEditor'

/**
 * La fiche d'une plante s'ouvre depuis plusieurs onglets — l'accueil, le
 * calendrier, les plantes, un jardin. Chacun a sa pile, pour que le retour
 * ramène là d'où l'on vient ; l'écran, lui, doit rester le même.
 *
 * Ces deux fabriques donnent la route d'un onglet en une ligne, au lieu de
 * recopier le même écran quatre fois.
 */

/**
 * Fiche d'une plante. `editHref` et `diagnoseHref` donnent les chemins **dans
 * la pile courante** — ils diffèrent d'un onglet à l'autre, d'où les
 * paramètres plutôt qu'un préfixe deviné.
 */
export function plantDetailRoute(
  editHref: (plantId: string) => Href,
  diagnoseHref: (plantId: string) => Href,
  chatHref: (plantId: string) => Href,
) {
  return function PlanteDetailScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()
    const router = useRouter()

    return (
      <PlantDetail
        plantId={plantId}
        onEdit={() => router.push(editHref(plantId))}
        onDiagnose={() => router.push(diagnoseHref(plantId))}
        onChat={(query) => router.push(`${chatHref(plantId)}${query}` as Href)}
      />
    )
  }
}

/**
 * Fil de discussion, ancré par les paramètres de la route.
 *
 * L'ancrage vient de l'écran d'où l'on part — une plante, un diagnostic, une
 * carte du calendrier — et voyage donc dans l'URL. Le cliché de l'action y est
 * encodé en JSON : les actions du moteur ne sont persistées nulle part, et le
 * serveur ne saurait pas la retrouver.
 */
export function plantChatRoute() {
  return function DiscussionPlanteScreen() {
    const params = useLocalSearchParams<{
      plantId: string
      kind?: string
      diagnosisId?: string
      taskId?: string
      actionKey?: string
      action?: string
      draft?: string
    }>()

    return <ChatScreen anchor={anchorFromParams(params)} draft={params.draft} />
  }
}

function anchorFromParams(params: {
  plantId: string
  kind?: string
  diagnosisId?: string
  taskId?: string
  actionKey?: string
  action?: string
}): OpenConversationInput {
  const plantInstanceId = params.plantId

  if (params.kind === 'diagnosis' && params.diagnosisId) {
    return { kind: 'diagnosis', plantInstanceId, diagnosisId: params.diagnosisId }
  }

  if (params.kind === 'action' && params.action && (params.taskId || params.actionKey)) {
    const action = safeParseAction(params.action)
    if (action) {
      return {
        kind: 'action',
        plantInstanceId,
        // L'un ou l'autre, jamais les deux : le contrat partagé le refuse.
        ...(params.taskId ? { taskId: params.taskId } : { actionKey: params.actionKey }),
        action,
      }
    }
  }

  // Un paramètre manquant ou illisible n'a pas à mener nulle part : le fil de
  // la plante reste utile, et l'utilisateur peut poser sa question.
  return { kind: 'plant', plantInstanceId }
}

function safeParseAction(raw: string) {
  try {
    const parsed = chatActionSnapshotSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Diagnostic d'une plante — le même quelle que soit la pile. */
export function plantDiagnosisRoute(chatHref: (plantId: string) => Href) {
  return function DiagnosticPlanteScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()
    const router = useRouter()

    return (
      <DiagnosisScreen
        plantId={plantId}
        onChat={(query) => router.push(`${chatHref(plantId)}${query}` as Href)}
      />
    )
  }
}

/**
 * Édition d'une plante.
 *
 * `afterDeleteHref` est la liste vers laquelle revenir après une suppression :
 * la fiche de la plante, juste au-dessous dans la pile, n'existe plus. Elle
 * diffère d'un onglet à l'autre, d'où le paramètre.
 */
export function plantEditorRoute(afterDeleteHref: Href) {
  return function ModifierPlanteScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()

    return <PlantEditor plantId={plantId} afterDeleteHref={afterDeleteHref} />
  }
}
