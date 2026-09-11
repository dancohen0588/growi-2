import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ce que les services émettent, avec quelles propriétés.
 *
 * L'émetteur est doublé : ce qu'on vérifie ici, c'est le **contenu** de
 * l'événement — un nom d'espèce mal compté ou une latence à zéro ne se
 * verraient nulle part ailleurs, et fausseraient un tableau de bord sans
 * jamais rien casser. Que la mesure ne puisse pas faire échouer le geste
 * qu'elle décrit est garanti dans l'émetteur lui-même : voir `server.test.ts`.
 */

const analytics = vi.hoisted(() => ({
  trackServer: vi.fn(),
  trackAnonymous: vi.fn(),
  setPersonProperties: vi.fn(),
}))
vi.mock('@/lib/analytics/server', () => analytics)

const person = vi.hoisted(() => ({
  refreshGardenCounts: vi.fn(),
  countPlants: vi.fn().mockResolvedValue(7),
}))
vi.mock('@/lib/analytics/person', () => person)

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  garden: { create: vi.fn(), findFirst: vi.fn() },
  plantInstance: { create: vi.fn(), findUniqueOrThrow: vi.fn(), findUnique: vi.fn() },
  plantCatalog: { findUnique: vi.fn() },
  pushToken: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  contactMessage: { create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prismaMock) : Promise.resolve([]),
  ),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const gemini = vi.hoisted(() => ({
  generateJson: vi.fn(),
  requireGeminiKey: vi.fn(() => 'clé'),
  parseImagePayload: vi.fn(() => ({ mimeType: 'image/jpeg', data: 'QUJD' })),
  estimateBase64Bytes: vi.fn(() => 1234),
  stripFence: (raw: string) => raw,
}))
vi.mock('@/lib/services/gemini', () => gemini)

const bcrypt = vi.hoisted(() => ({
  default: { hash: vi.fn(async () => '$2a$hashé'), compare: vi.fn(async () => true) },
}))
vi.mock('bcryptjs', () => bcrypt)

vi.mock('@/lib/recommendation/garden-advice-service', () => ({
  invalidateGardenAdviceCache: vi.fn(),
}))
vi.mock('@/lib/storage', () => ({ deletePhotoByUrl: vi.fn(), uploadPhoto: vi.fn() }))

const { identifyPlant } = await import('@/lib/services/identify.service')
const { createGarden } = await import('@/lib/services/garden.service')
const { registerPushToken, forgetInvalidTokens } = await import('@/lib/services/push.service')
const { createUser, verifyCredentials } = await import('@/lib/services/user.service')

beforeEach(() => {
  vi.clearAllMocks()
  person.countPlants.mockResolvedValue(7)
})

describe('identification', () => {
  const OK = {
    ok: true as const,
    model: 'gemini-2.5-flash',
    fallback: false,
    usage: { inputTokens: 1200, outputTokens: 300, totalTokens: 1500 },
    raw: JSON.stringify({ identified: true, confidence: 'high', commonName: 'Basilic', scientificName: 'Ocimum basilicum' }),
  }

  it('émet le résultat, ses jetons et une latence mesurée', async () => {
    // Une latence nulle passerait inaperçue dans une moyenne, et ferait croire
    // à une IA instantanée : le test impose une horloge qui avance.
    gemini.generateJson.mockImplementation(async () => {
      vi.advanceTimersByTime(4200)
      return OK
    })
    vi.useFakeTimers()

    await identifyPlant('data:image/jpeg;base64,QUJD', 'user_1')

    vi.useRealTimers()

    expect(analytics.trackServer).toHaveBeenCalledWith(
      'user_1',
      'identify_completed',
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        input_tokens: 1200,
        output_tokens: 300,
        candidates_count: 1,
        top_confidence: 'high',
        image_bytes: 1234,
      }),
    )

    const [, , props] = analytics.trackServer.mock.calls[0]
    expect((props as { latency_ms: number }).latency_ms).toBeGreaterThan(0)
  })

  it("traduit l'échec du modèle en cause stable", async () => {
    gemini.generateJson.mockResolvedValue({ ok: false, reason: 'Quota…', cause: 'quota' })

    await identifyPlant('data:image/jpeg;base64,QUJD', 'user_1')

    expect(analytics.trackServer).toHaveBeenCalledWith('user_1', 'identify_failed', {
      reason: 'quota',
      model: null,
    })
  })

  it('distingue un JSON illisible du reste', async () => {
    gemini.generateJson.mockResolvedValue({ ...OK, raw: 'pas du json' })

    await identifyPlant('data:image/jpeg;base64,QUJD', 'user_1')

    expect(analytics.trackServer).toHaveBeenCalledWith('user_1', 'identify_failed', {
      reason: 'parse',
      model: 'gemini-2.5-flash',
    })
  })

  it("n'émet rien pour une identification anonyme", async () => {
    gemini.generateJson.mockResolvedValue(OK)

    await identifyPlant('data:image/jpeg;base64,QUJD')

    expect(analytics.trackServer).not.toHaveBeenCalled()
  })

  // La résistance à un émetteur en panne est garantie **dans `trackServer`
  // lui-même**, qui avale ses erreurs — c'est `server.test.ts` qui l'atteste.
  // La vérifier ici demanderait un second filet dans chaque service, pour une
  // exception qui ne peut pas sortir.
})

describe('jardin', () => {
  it("note la création et le fait que le compte ait une position", async () => {
    prismaMock.garden.create.mockResolvedValue({ id: 'g1' })
    prismaMock.user.findUnique.mockResolvedValue({ latitude: 47.2, longitude: -1.5 })

    await createGarden('user_1', { name: 'Potager', type: 'OUTDOOR' })
    // La mesure part hors du chemin critique : on laisse tourner la boucle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(analytics.trackServer).toHaveBeenCalledWith('user_1', 'garden_created', {
      has_location: true,
      from_cadastre: false,
      zones_count: 0,
    })
    expect(person.refreshGardenCounts).toHaveBeenCalledWith('user_1')
  })

  it('rend le jardin même si le recomptage échoue', async () => {
    prismaMock.garden.create.mockResolvedValue({ id: 'g1' })
    prismaMock.user.findUnique.mockRejectedValue(new Error('base indisponible'))

    await expect(createGarden('user_1', { name: 'Potager', type: 'OUTDOOR' })).resolves.toEqual({
      id: 'g1',
    })
  })
})

describe('notifications', () => {
  it("un jeton enregistré vaut permission accordée", async () => {
    await registerPushToken('user_1', { token: 'ExponentPushToken[x]', platform: 'ios' })

    expect(analytics.setPersonProperties).toHaveBeenCalledWith('user_1', { push_granted: true })
  })

  it('lit les jetons morts avant de les supprimer, pour savoir à qui ils étaient', async () => {
    prismaMock.pushToken.findMany.mockResolvedValue([{ userId: 'user_1', platform: 'android' }])

    await forgetInvalidTokens(['ExponentPushToken[mort]'])

    expect(analytics.trackServer).toHaveBeenCalledWith('user_1', 'push_token_invalid', {
      platform: 'android',
    })
    expect(prismaMock.pushToken.deleteMany).toHaveBeenCalled()
  })

  it('ne fait rien sur une liste vide', async () => {
    await forgetInvalidTokens([])
    expect(prismaMock.pushToken.findMany).not.toHaveBeenCalled()
  })
})

/**
 * Inscription et connexion : la mesure est posée sur le **point de passage
 * commun** aux deux surfaces, pas dans le service d'authentification.
 *
 * Ces quatre tests existent parce que l'inverse est arrivé : l'événement vivait
 * dans `auth.service`, que seule l'API mobile emprunte, et les inscriptions du
 * web ne laissaient aucune trace. Rien ne le signalait — l'entonnoir
 * d'activation restait simplement vide.
 */
describe('authentification', () => {
  it("compte l'inscription, quelle que soit la surface", async () => {
    prismaMock.user.create.mockResolvedValue({ id: 'user_neuf' })

    await createUser({ email: 'jardinier@exemple.fr', password: 'motdepasse', firstName: 'Sophie' })

    expect(analytics.trackServer).toHaveBeenCalledWith('user_neuf', 'signup_completed', {
      method: 'email',
    })
    expect(analytics.setPersonProperties).toHaveBeenCalledWith(
      'user_neuf',
      expect.objectContaining({ signup_method: 'email' }),
    )
  })

  it('compte la connexion réussie', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_1',
      password: '$2a$hashé',
      disabledAt: null,
    })

    await verifyCredentials('jardinier@exemple.fr', 'motdepasse')

    expect(analytics.trackServer).toHaveBeenCalledWith('user_1', 'login_completed', {
      method: 'email',
    })
  })

  it("n'attribue pas un échec à un compte, même quand l'adresse existe", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_1',
      password: '$2a$hashé',
      disabledAt: null,
    })
    bcrypt.default.compare.mockResolvedValueOnce(false)

    await verifyCredentials('jardinier@exemple.fr', 'faux')

    // Rattacher l'échec au compte reviendrait à confirmer que l'adresse est
    // enregistrée — la raison même pour laquelle les messages sont indistincts.
    expect(analytics.trackAnonymous).toHaveBeenCalledWith('login_failed', {
      method: 'email',
      reason: 'bad_credentials',
    })
    expect(analytics.trackServer).not.toHaveBeenCalled()
  })

  it('distingue un compte désactivé, sans le dire à qui essaie', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user_1',
      password: '$2a$hashé',
      disabledAt: new Date(),
    })

    await verifyCredentials('jardinier@exemple.fr', 'motdepasse')

    expect(analytics.trackAnonymous).toHaveBeenCalledWith('login_failed', {
      method: 'email',
      reason: 'account_disabled',
    })
  })
})
