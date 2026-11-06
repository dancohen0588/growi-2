import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Server Actions de la sève : authentification refaite, validation avant le
 * service, erreurs rendues en résultat — et rien d'interne dans l'historique.
 * Le service est doublé : rien ici n'atteint Prisma.
 */

const authMock = vi.hoisted(() => vi.fn())
vi.mock('@/auth', () => ({ auth: authMock }))

const revalidatePath = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath }))

const sapService = vi.hoisted(() => ({
  getSapSummary: vi.fn(),
  giveSapDrop: vi.fn(),
  listSapHistory: vi.fn(),
}))
vi.mock('@/lib/services/sap.service', () => sapService)
const rewardsService = vi.hoisted(() => ({ setHomeTheme: vi.fn() }))
vi.mock('@/lib/services/sap-rewards.service', () => rewardsService)
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const { ServiceError } = await import('@/lib/services/errors')
const actions = await import('../sap')

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'user-1' } })
})

describe('giveSapDropAction', () => {
  it('refuse sans session, sans appeler le service', async () => {
    authMock.mockResolvedValue(null)
    const result = await actions.giveSapDropAction({ handle: 'camille', reason: 'aide' })
    expect(result).toEqual({ ok: false, error: 'Reconnecte-toi pour continuer.', code: 'UNAUTHENTICATED' })
    expect(sapService.giveSapDrop).not.toHaveBeenCalled()
  })

  it('valide avant le service : un motif inconnu n’offre rien', async () => {
    const result = await actions.giveSapDropAction({ handle: 'camille', reason: 'argent' })
    expect(result.ok).toBe(false)
    expect(sapService.giveSapDrop).not.toHaveBeenCalled()
  })

  it('offre au nom de la session, pseudo normalisé, et revalide les deux écrans', async () => {
    sapService.giveSapDrop.mockResolvedValue({ giftsLeft: 1 })

    const result = await actions.giveSapDropAction({ handle: 'Camille', reason: 'bouture', message: '  Merci !  ' })

    expect(result).toEqual({ ok: true, data: { giftsLeft: 1 } })
    expect(sapService.giveSapDrop).toHaveBeenCalledWith('user-1', {
      handle: 'camille',
      reason: 'bouture',
      message: 'Merci !',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/seve')
  })

  it('rend le refus du quota avec son code, sans lever', async () => {
    sapService.giveSapDrop.mockRejectedValue(new ServiceError('QUOTA_EXCEEDED', 'Plus de gouttes cette semaine.'))
    const result = await actions.giveSapDropAction({ handle: 'camille', reason: 'aide' })
    expect(result).toEqual({ ok: false, error: 'Plus de gouttes cette semaine.', code: 'QUOTA_EXCEEDED' })
  })

  it('ne dit pas pourquoi un profil est injoignable', async () => {
    sapService.giveSapDrop.mockRejectedValue(new ServiceError('NOT_FOUND', 'Profil introuvable'))
    const result = await actions.giveSapDropAction({ handle: 'camille', reason: 'aide' })
    expect(result).toMatchObject({ ok: false, error: 'Ce jardinier n’est plus joignable.' })
  })

  it('une panne inattendue reste un résultat', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sapService.giveSapDrop.mockRejectedValue(new Error('boom'))
    const result = await actions.giveSapDropAction({ handle: 'camille', reason: 'aide' })
    expect(result).toEqual({ ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' })
  })
})

describe('getGiftQuotaAction', () => {
  it('ne rend que le compteur', async () => {
    sapService.getSapSummary.mockResolvedValue({ total: 12, rings: {}, giftsLeft: 2, giftsPerWeek: 3, recent: [] })
    expect(await actions.getGiftQuotaAction()).toEqual({ ok: true, data: { giftsLeft: 2, giftsPerWeek: 3 } })
    expect(sapService.getSapSummary).toHaveBeenCalledWith('user-1')
  })
})

describe('loadSapHistoryAction', () => {
  it('transmet le curseur et sérialise champ par champ', async () => {
    sapService.listSapHistory.mockResolvedValue({
      items: [
        {
          id: 'e1',
          userId: 'user-1',
          kind: 'care',
          amount: 1,
          sourceId: 'log_secret',
          day: '2026-11-06',
          label: 'Arrosage',
          createdAt: new Date('2026-11-06T08:00:00Z'),
        },
      ],
      nextCursor: 'next',
    })

    const result = await actions.loadSapHistoryAction('abc')

    expect(sapService.listSapHistory).toHaveBeenCalledWith('user-1', 'abc')
    expect(result).toEqual({
      ok: true,
      data: {
        items: [{ id: 'e1', kind: 'care', amount: 1, label: 'Arrosage', createdAt: '2026-11-06T08:00:00.000Z' }],
        nextCursor: 'next',
      },
    })
  })
})

describe('setHomeThemeAction', () => {
  it('valide le thème avant le service', async () => {
    const result = await actions.setHomeThemeAction({ theme: 'jungle' })
    expect(result).toEqual({ ok: false, error: 'Thème inconnu', code: 'INVALID_INPUT' })
    expect(rewardsService.setHomeTheme).not.toHaveBeenCalled()
  })

  it('pose le thème et revalide l’accueil', async () => {
    rewardsService.setHomeTheme.mockResolvedValue('prairie')
    expect(await actions.setHomeThemeAction({ theme: 'prairie' })).toEqual({ ok: true, data: { homeTheme: 'prairie' } })
    expect(rewardsService.setHomeTheme).toHaveBeenCalledWith('user-1', 'prairie')
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('un thème pas encore débloqué revient en message', async () => {
    rewardsService.setHomeTheme.mockRejectedValue(new ServiceError('FORBIDDEN', 'Pas encore débloqué'))
    expect(await actions.setHomeThemeAction({ theme: 'crepuscule' })).toMatchObject({ ok: false, error: 'Pas encore débloqué' })
  })
})
