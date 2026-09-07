import type { CreateReportInput, ReportReceipt } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

/**
 * Signalements.
 *
 * Le geste est volontairement pauvre côté utilisateur : un motif, une note
 * facultative, et rien en retour. Ce qu'on en fait — file de modération,
 * masquage automatique au-delà du seuil — vit dans le portail admin.
 */

/**
 * Enregistre un signalement.
 *
 * **Idempotent.** L'unicité `(reporterId, targetType, targetId)` fait qu'on ne
 * signale un contenu qu'une fois ; recommencer n'est pas une faute à afficher,
 * c'est de l'insistance. La route répond donc la même chose dans les deux cas.
 *
 * La réponse ne dit rien du nombre de signalements reçus ni de l'état du
 * contenu : ce compteur deviendrait sinon un instrument de mesure pour qui
 * cherche à faire taire quelqu'un.
 *
 * @throws ServiceError('NOT_FOUND') si le compte signalé n'existe pas,
 * ServiceError('INVALID_INPUT') si l'on se signale soi-même.
 */
export async function report(
  userId: string,
  input: CreateReportInput,
): Promise<ReportReceipt> {
  if (input.targetType === 'user') {
    if (input.targetId === userId) {
      throw new ServiceError('INVALID_INPUT', 'On ne se signale pas soi-même.')
    }

    const target = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    })
    if (!target) throw new ServiceError('NOT_FOUND', 'Ce compte est introuvable.')
  }

  await prisma.report.createMany({
    data: {
      reporterId: userId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      note: input.note ?? null,
    },
    skipDuplicates: true,
  })

  return { reported: true }
}
