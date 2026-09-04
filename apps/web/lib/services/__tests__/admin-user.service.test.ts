import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { buildUserWhere, listUsers, USERS_PAGE_SIZE } = await import('../admin-user.service')

beforeEach(() => {
  vi.clearAllMocks()
})

function row(index: number, createdAt: Date) {
  return {
    id: `user_${index}`,
    email: `u${index}@growi.fr`,
    name: null,
    firstName: `U${index}`,
    lastName: null,
    plan: 'FREE',
    role: 'USER',
    onboarded: true,
    locationCity: null,
    createdAt,
    lastSeenAt: null,
    disabledAt: null,
    _count: { gardens: 0, plantInstances: 0 },
  }
}

describe('buildUserWhere', () => {
  it('ne filtre rien sans critère', () => {
    expect(buildUserWhere({})).toEqual({})
  })

  it('cherche sur les quatre champs d’identité, sans la casse', () => {
    const where = buildUserWhere({ search: '  Dupont ' })
    const or = (where.AND as Array<{ OR: unknown[] }>)[0].OR

    expect(or).toHaveLength(4)
    expect(or).toContainEqual({ email: { contains: 'Dupont', mode: 'insensitive' } })
    expect(or).toContainEqual({ lastName: { contains: 'Dupont', mode: 'insensitive' } })
  })

  it('ignore une recherche vide ou blanche', () => {
    expect(buildUserWhere({ search: '   ' })).toEqual({})
  })

  it('traduit « actif » par disabledAt à null, pas par une date différente', () => {
    // Le piège : `{ not: null }` pour `disabled: false` écarterait précisément
    // tous les comptes actifs.
    expect(buildUserWhere({ disabled: false }).AND).toEqual([{ disabledAt: null }])
    expect(buildUserWhere({ disabled: true }).AND).toEqual([{ disabledAt: { not: null } }])
  })

  it('inclut les comptes jamais vus dans « sans activité depuis »', () => {
    const since = new Date('2026-08-01T00:00:00.000Z')
    expect(buildUserWhere({ inactiveSince: since }).AND).toEqual([
      { OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: since } }] },
    ])
  })

  it('cumule les critères', () => {
    const where = buildUserWhere({ role: 'ADMIN', plan: 'PREMIUM', onboarded: true })
    expect(where.AND).toEqual([{ role: 'ADMIN' }, { plan: 'PREMIUM' }, { onboarded: true }])
  })
})

describe('listUsers', () => {
  it('demande une ligne de plus que la page pour savoir s’il y a une suite', async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    await listUsers()

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: USERS_PAGE_SIZE + 1 }),
    )
  })

  it('renvoie un curseur quand la ligne supplémentaire existe, et la retire', async () => {
    const base = new Date('2026-09-01T00:00:00.000Z')
    const rows = Array.from({ length: 4 }, (_, i) => row(i, new Date(base.getTime() - i * 1000)))
    prismaMock.user.findMany.mockResolvedValue(rows)

    const page = await listUsers({}, null, 3)

    expect(page.users).toHaveLength(3)
    // Le curseur pointe la dernière ligne **rendue**, pas la ligne sentinelle.
    expect(page.nextCursor).toEqual({ createdAt: rows[2].createdAt, id: 'user_2' })
  })

  it('ne renvoie pas de curseur sur la dernière page', async () => {
    prismaMock.user.findMany.mockResolvedValue([row(0, new Date())])
    const page = await listUsers({}, null, 3)

    expect(page.users).toHaveLength(1)
    expect(page.nextCursor).toBeNull()
  })

  it('traduit le curseur en « strictement après », id compris', async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    const createdAt = new Date('2026-09-01T00:00:00.000Z')

    await listUsers({}, { createdAt, id: 'user_9' })

    const where = prismaMock.user.findMany.mock.calls[0][0].where
    // Deux comptes créés dans la même milliseconde : sans la clause sur l'id,
    // l'un des deux serait sauté.
    expect(where.AND).toContainEqual({
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: 'user_9' } }],
    })
  })

  it('conserve les filtres quand un curseur est fourni', async () => {
    prismaMock.user.findMany.mockResolvedValue([])

    await listUsers({ role: 'ADMIN' }, { createdAt: new Date(), id: 'user_9' })

    const where = prismaMock.user.findMany.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ role: 'ADMIN' })
    expect(where.AND).toHaveLength(2)
  })

  it('trie de façon déterministe, dans le même sens que le curseur', async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    await listUsers()

    expect(prismaMock.user.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ])
  })
})
