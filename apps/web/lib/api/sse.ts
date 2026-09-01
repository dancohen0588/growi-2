/**
 * Réponse `text/event-stream` bâtie sur un générateur asynchrone.
 *
 * Deux choix méritent d'être dits :
 *
 * - **Le générateur est vidé jusqu'au bout, même si le client est parti.**
 *   Une réponse d'assistant se persiste en fin de flux ; abandonner la lecture
 *   à la déconnexion perdrait un tour de conversation déjà payé au modèle,
 *   que l'utilisateur s'attend à retrouver en rouvrant le fil. Les envois qui
 *   échouent après son départ sont donc ignorés, pas propagés.
 * - **`X-Accel-Buffering: no` et `no-transform`** : sans eux, un proxy peut
 *   accumuler la réponse et ne la rendre qu'à la fin — le streaming n'existe
 *   alors plus que dans le code.
 */

import { NextResponse } from 'next/server'

const encoder = new TextEncoder()

export type SseEvent = { event: string; data: unknown }

export function sseResponse(events: AsyncGenerator<SseEvent>): NextResponse {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true
      try {
        for await (const event of events) {
          if (!open) continue
          try {
            controller.enqueue(
              encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`),
            )
          } catch {
            // Client parti : on cesse d'écrire, on continue de lire.
            open = false
          }
        }
      } catch (err) {
        console.error('[sse] flux interrompu', err)
        if (open) {
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ code: 'INTERNAL', message: 'Une erreur interne est survenue.' })}\n\n`,
              ),
            )
          } catch {
            open = false
          }
        }
      } finally {
        try {
          controller.close()
        } catch {
          // Déjà fermé par le départ du client.
        }
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform, no-store, private',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
