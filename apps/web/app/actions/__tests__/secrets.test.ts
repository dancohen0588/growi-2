import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Actions des secrets : authentification refaite, validation avant le
 * service, et erreurs rendues en résultat — jamais levées vers le client.
 *
 * Les services sont doublés : leur logique est testée ailleurs, et rien ici ne
 * doit atteindre Prisma.
 */

const authMock = vi.hoisted(() => vi.fn())
vi.mock('@/auth', () => ({ auth: authMock }))

const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))

const secretsService = vi.hoisted(() => ({
  revealSecret: vi.fn(),
  dismissSecret: vi.fn(),
  restoreSecret: vi.fn(),
  recordSecretFeedback: vi.fn(),
}))
vi.mock('@/lib/services/secrets.service', () => secretsService)

const userService = vi.hoisted(() => ({ updateProfile: vi.fn() }))
vi.mock('@/lib/services/user.service', () => userService)

// Filet : si un import réel s'y glissait, il ne parlerait à aucune base.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { ServiceError } = await import('@/lib/services/errors')
const actions = await import('../secrets')

const CARE_LOG_ID = 'cmh0000000000000000000001'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('authentification', () => {
  it('refuse sans session, sans appeler le service', async () => {
    authMock.mockResolvedValue(null)

    const result = await actions.dismissSecretAction('purin-ortie')

    expect(result).toEqual({ ok: false, error: 'Reconnecte-toi pour continuer.' })
    expect(secretsService.dismissSecret).not.toHaveBeenCalled()
  })
})

describe('revealSecretAction', () => {
  it('dévoile pour l’utilisateur de la session et ne revalide que le grimoire', async () => {
    const result = await actions.revealSecretAction('coquilles-oeuf')

    expect(result).toEqual({ ok: true })
    expect(secretsService.revealSecret).toHaveBeenCalledWith('user-1', 'coquilles-oeuf')
    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/grimoire')
  })

  it('refuse un slug hors format avant le service', async () => {
    const result = await actions.revealSecretAction('../../etc')

    expect(result.ok).toBe(false)
    expect(secretsService.revealSecret).not.toHaveBeenCalled()
  })

  it('rend le message d’une ServiceError, sans lever', async () => {
    secretsService.revealSecret.mockRejectedValue(new ServiceError('NOT_FOUND', 'Secret introuvable'))

    await expect(actions.revealSecretAction('inconnu')).resolves.toEqual({
      ok: false,
      error: 'Secret introuvable',
    })
  })

  it('masque une panne inattendue derrière un message générique', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    secretsService.revealSecret.mockRejectedValue(new Error('connexion perdue'))

    const result = await actions.revealSecretAction('coquilles-oeuf')

    expect(result).toEqual({ ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' })
  })
})

describe('dismiss et restore', () => {
  it('revalident le calendrier et le grimoire', async () => {
    await actions.dismissSecretAction('purin-ortie')
    await actions.restoreSecretAction('purin-ortie')

    expect(secretsService.dismissSecret).toHaveBeenCalledWith('user-1', 'purin-ortie')
    expect(secretsService.restoreSecret).toHaveBeenCalledWith('user-1', 'purin-ortie')
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/dashboard/calendrier',
      '/dashboard/grimoire',
      '/dashboard/calendrier',
      '/dashboard/grimoire',
    ])
  })
})

describe('secretFeedbackAction', () => {
  it('transmet le verdict validé', async () => {
    const result = await actions.secretFeedbackAction({ careLogId: CARE_LOG_ID, verdict: 'WORKED' })

    expect(result).toEqual({ ok: true })
    expect(secretsService.recordSecretFeedback).toHaveBeenCalledWith('user-1', {
      careLogId: CARE_LOG_ID,
      verdict: 'WORKED',
    })
  })

  it('refuse un verdict inconnu', async () => {
    const result = await actions.secretFeedbackAction({
      careLogId: CARE_LOG_ID,
      verdict: 'MAYBE' as never,
    })

    expect(result).toEqual({ ok: false, error: 'Réponse invalide' })
    expect(secretsService.recordSecretFeedback).not.toHaveBeenCalled()
  })
})

describe('setLunarCalendarAction', () => {
  it('passe par updateProfile', async () => {
    const result = await actions.setLunarCalendarAction(true)

    expect(result).toEqual({ ok: true })
    expect(userService.updateProfile).toHaveBeenCalledWith('user-1', { lunarCalendar: true })
  })

  it('refuse autre chose qu’un booléen', async () => {
    const result = await actions.setLunarCalendarAction('oui' as never)

    expect(result.ok).toBe(false)
    expect(userService.updateProfile).not.toHaveBeenCalled()
  })
})
