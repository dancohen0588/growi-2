/**
 * Client de l'API Expo Push.
 *
 * Expo relaie les notifications vers APNs et FCM : pas de certificat à gérer
 * ici, un simple POST suffit. Deux règles imposées par l'API et respectées
 * dans ce module :
 *
 * - **cent messages par requête** au maximum ;
 * - **un jeton mort doit être supprimé**. Expo répond `DeviceNotRegistered`
 *   quand l'app a été désinstallée ; continuer à lui écrire fait dégrader la
 *   réputation de l'expéditeur.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

/** Limite imposée par Expo. */
export const MAX_MESSAGES_PER_REQUEST = 100

export interface PushMessage {
  to: string
  title: string
  body: string
  /** Données transmises à l'app, pour ouvrir le bon écran. */
  data?: Record<string, unknown>
  sound?: 'default' | null
  badge?: number
}

export interface PushSendResult {
  sent: number
  /** Jetons qu'Expo déclare morts : à supprimer de la base. */
  invalidTokens: string[]
  /** Échecs pour une autre raison — journalisés, sans suppression. */
  failed: number
}

interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string; expoPushToken?: string }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Envoie des notifications, par lots de cent.
 *
 * Ne lève jamais : un envoi raté ne doit pas interrompre la tournée du matin
 * pour les autres utilisateurs. Les échecs sont comptés et journalisés.
 */
export async function sendPushMessages(
  messages: PushMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, invalidTokens: [], failed: 0 }
  if (messages.length === 0) return result

  for (const batch of chunk(messages, MAX_MESSAGES_PER_REQUEST)) {
    try {
      const response = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          // Expo compresse les réponses volumineuses ; on l'accepte.
          'accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      })

      if (!response.ok) {
        console.error('[push] Expo a refusé le lot :', response.status)
        result.failed += batch.length
        continue
      }

      const body = (await response.json()) as { data?: ExpoTicket[] }
      const tickets = body.data ?? []

      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          result.sent += 1
          return
        }

        result.failed += 1

        // Le jeton d'un appareil où l'app n'est plus installée doit partir.
        if (ticket.details?.error === 'DeviceNotRegistered') {
          const token = ticket.details.expoPushToken ?? batch[index]?.to
          if (token) result.invalidTokens.push(token)
        } else {
          console.error('[push] échec :', ticket.details?.error, ticket.message)
        }
      })
    } catch (error) {
      console.error('[push] envoi impossible :', error)
      result.failed += batch.length
    }
  }

  return result
}
