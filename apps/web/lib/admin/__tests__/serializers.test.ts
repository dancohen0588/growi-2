import { describe, expect, it } from 'vitest'

import { displayNameOf, serializeAdminUserRow, serializeAuditRow } from '../serializers'

/**
 * La raison d'être de ces tests : le portail voit tout, il ne doit pas tout
 * montrer. Un sérialiseur qui recopierait la ligne Prisma laisserait passer le
 * condensat du mot de passe dans le HTML rendu.
 */

const SENSITIVE = [
  'password',
  'tokenHash',
  'token',
  'accessToken',
  'refreshToken',
  'id_token',
  'access_token',
]

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user_1',
    email: 'jules@growi.fr',
    name: null,
    firstName: 'Jules',
    lastName: 'Martin',
    plan: 'FREE',
    role: 'USER',
    onboarded: true,
    locationCity: 'Lyon',
    createdAt: new Date('2026-01-05T10:00:00.000Z'),
    lastSeenAt: new Date('2026-09-01T08:00:00.000Z'),
    disabledAt: null,
    _count: { gardens: 2, plantInstances: 11 },
    ...overrides,
  }
}

describe('serializeAdminUserRow', () => {
  it("n'expose aucun champ sensible, même s'il est présent dans la ligne", () => {
    // On lui donne délibérément une ligne polluée : le sérialiseur construit
    // son résultat champ par champ, rien ne doit ressortir.
    const polluted = userRow({
      password: '$2a$12$condensat',
      accounts: [{ id_token: 'jwt', access_token: 'jeton' }],
      refreshTokens: [{ tokenHash: 'empreinte' }],
    })

    const serialized = serializeAdminUserRow(polluted)
    const json = JSON.stringify(serialized)

    for (const key of SENSITIVE) {
      expect(json).not.toContain(key)
    }
    expect(json).not.toContain('condensat')
    expect(json).not.toContain('empreinte')
  })

  it('expose exactement les champs attendus', () => {
    expect(Object.keys(serializeAdminUserRow(userRow())).sort()).toEqual(
      [
        'city',
        'createdAt',
        'disabledAt',
        'displayName',
        'email',
        'firstName',
        'gardens',
        'id',
        'lastName',
        'lastSeenAt',
        'onboarded',
        'plan',
        'plants',
        'role',
      ].sort(),
    )
  })

  it('reporte les agrégats de jardins et de plantes', () => {
    const row = serializeAdminUserRow(userRow())
    expect(row.gardens).toBe(2)
    expect(row.plants).toBe(11)
  })
})

describe('displayNameOf', () => {
  const base = { firstName: null, lastName: null, name: null, email: 'a@growi.fr' }

  it('préfère prénom et nom', () => {
    expect(displayNameOf({ ...base, firstName: 'Jules', lastName: 'Martin' })).toBe('Jules Martin')
  })

  it('se contente du prénom quand le nom manque', () => {
    expect(displayNameOf({ ...base, firstName: 'Jules' })).toBe('Jules')
  })

  it('retombe sur `name`, puis sur l’email', () => {
    expect(displayNameOf({ ...base, name: 'Jules M.' })).toBe('Jules M.')
    // Un compte Apple avec adresse masquée n'a ni l'un ni l'autre : une ligne
    // de tableau sans aucun repère serait inutilisable.
    expect(displayNameOf(base)).toBe('a@growi.fr')
  })

  it('ignore les champs qui ne contiennent que des espaces', () => {
    expect(displayNameOf({ ...base, firstName: '  ', name: '  ' })).toBe('a@growi.fr')
  })
})

describe('serializeAuditRow', () => {
  const labels = { action: () => 'Libellé action', target: () => 'Libellé cible' }

  it('traduit les libellés et compose le nom de l’acteur', () => {
    const row = serializeAuditRow(
      {
        id: 'log_1',
        action: 'user.disable',
        targetType: 'user',
        targetId: 'user_2',
        details: { avant: null },
        createdAt: new Date('2026-09-04T12:00:00.000Z'),
        actor: {
          id: 'user_1',
          email: 'dan@growi.fr',
          name: null,
          firstName: 'Dan',
          lastName: 'Cohen',
        },
      },
      labels,
    )

    expect(row.actionLabel).toBe('Libellé action')
    expect(row.targetLabel).toBe('Libellé cible')
    expect(row.actor).toEqual({ id: 'user_1', email: 'dan@growi.fr', displayName: 'Dan Cohen' })
  })

  it('tient un acteur supprimé', () => {
    const row = serializeAuditRow(
      {
        id: 'log_2',
        action: 'user.update',
        targetType: 'user',
        targetId: 'user_2',
        details: null,
        createdAt: new Date(),
        actor: null,
      },
      labels,
    )

    expect(row.actor).toBeNull()
  })
})
