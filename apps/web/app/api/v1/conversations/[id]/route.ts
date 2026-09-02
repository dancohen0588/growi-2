import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getConversation } from '@/lib/services/chat.service'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

type Context = { params: { id: string } }

/** Recharge un fil, ses messages et le quota du jour. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await getConversation(userId, params.id))
})
