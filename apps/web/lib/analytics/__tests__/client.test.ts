import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Doublures ─────────────────────────────────────────────────────────────

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  register: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  setPersonProperties: vi.fn(),
}))
const enabled = vi.hoisted(() => ({ value: true }))

vi.mock('posthog-js', () => ({ default: posthogMock }))
vi.mock('posthog-js/react', () => ({ PostHogProvider: () => null }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('@/lib/analytics/enabled', () => ({ analyticsEnabled: () => enabled.value }))

// La clé est lue au chargement du module, comme dans le bundle navigateur.
vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
const { applyConsent, purgeLocalPostHogState, resetPostHogStateForTests } = await import(
  '@/lib/analytics/client'
)

// ─── Terminal factice ──────────────────────────────────────────────────────

/** Juste ce que la purge lit : un stockage local et `document.cookie`. */
function fakeBrowser(initial: { storage?: Record<string, string>; cookies?: string[] } = {}) {
  const storage = new Map(Object.entries(initial.storage ?? {}))
  const cookies = new Map(
    (initial.cookies ?? []).map((pair) => pair.split('=') as [string, string]),
  )

  const localStorage = {
    get length() {
      return storage.size
    },
    key: (i: number) => [...storage.keys()][i] ?? null,
    removeItem: (key: string) => void storage.delete(key),
  }
  const document = {
    get cookie() {
      return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    set cookie(value: string) {
      const [pair] = value.split(';')
      const [name, content] = pair.split('=')
      if (/Max-Age=0/.test(value)) cookies.delete(name.trim())
      else cookies.set(name.trim(), content)
    },
  }

  vi.stubGlobal('window', { localStorage })
  vi.stubGlobal('document', document)
  return { storage, cookies }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetPostHogStateForTests()
  enabled.value = true
  posthogMock.has_opted_out_capturing.mockReturnValue(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Règle d'émission ──────────────────────────────────────────────────────

describe('applyConsent', () => {
  it("n'initialise jamais PostHog sans un oui", () => {
    fakeBrowser()

    applyConsent(null).track('signup_completed', { method: 'email' })
    applyConsent(false).track('signup_completed', { method: 'email' })

    expect(posthogMock.init).not.toHaveBeenCalled()
    expect(posthogMock.capture).not.toHaveBeenCalled()
  })

  it('initialise une seule fois sur un oui, sans cookie ni enregistrement de session', () => {
    fakeBrowser()

    const emitter = applyConsent(true)
    applyConsent(true)

    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.init.mock.calls[0][1]).toMatchObject({
      persistence: 'localStorage',
      disable_session_recording: true,
      autocapture: false,
    })

    emitter.track('signup_completed', { method: 'email' })
    expect(posthogMock.capture).toHaveBeenCalledWith('signup_completed', { method: 'email' })
  })

  it('reste muet en local, même avec un oui', () => {
    fakeBrowser()
    enabled.value = false

    applyConsent(true).track('signup_completed', { method: 'email' })

    expect(posthogMock.init).not.toHaveBeenCalled()
    expect(posthogMock.capture).not.toHaveBeenCalled()
  })

  it("lève le drapeau de refus d'un retrait passé quand le compte redit oui", () => {
    fakeBrowser()
    posthogMock.has_opted_out_capturing.mockReturnValue(true)

    applyConsent(true)

    expect(posthogMock.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
  })

  it('au retrait : coupe la capture, rend un émetteur muet et vide le terminal', () => {
    const { storage } = fakeBrowser({ storage: { ph_phc_test_posthog: '{}' } })

    applyConsent(true)
    const emitter = applyConsent(false)
    emitter.track('signup_completed', { method: 'email' })

    expect(posthogMock.opt_out_capturing).toHaveBeenCalledTimes(1)
    expect(posthogMock.capture).not.toHaveBeenCalled()
    expect(storage.has('ph_phc_test_posthog')).toBe(false)
    // Pas de reset : il réécrirait un identifiant neuf dans le stockage vidé.
    expect(posthogMock.reset).not.toHaveBeenCalled()
  })

  it('rouvre la capture sans réinitialiser quand le oui revient dans la même page', () => {
    fakeBrowser()

    applyConsent(true)
    applyConsent(false)
    applyConsent(true)

    expect(posthogMock.init).toHaveBeenCalledTimes(1)
    expect(posthogMock.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
  })

  it("expire les cookies hérités de l'ancienne configuration, même sur un oui", () => {
    const { cookies } = fakeBrowser({ cookies: ['ph_phc_test_posthog=x', 'authjs.session-token=s'] })

    applyConsent(true)

    expect(cookies.has('ph_phc_test_posthog')).toBe(false)
    expect(cookies.has('authjs.session-token')).toBe(true)
  })
})

describe('purgeLocalPostHogState', () => {
  it('vide les clés et cookies ph_*, et laisse le reste', () => {
    const { storage, cookies } = fakeBrowser({
      storage: {
        ph_phc_test_posthog: '{}',
        ph_autre: '1',
        'growi.garden.current': 'g1',
        // Le drapeau de refus n'identifie personne : il reste.
        __ph_opt_in_out_phc_test: '0',
      },
      cookies: ['ph_phc_test_posthog=x', 'authjs.session-token=s'],
    })

    purgeLocalPostHogState()

    expect([...storage.keys()].sort()).toEqual(['__ph_opt_in_out_phc_test', 'growi.garden.current'])
    expect([...cookies.keys()]).toEqual(['authjs.session-token'])
  })

  it('ne lève pas quand le stockage est inaccessible', () => {
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('window', {
      get localStorage(): never {
        throw new Error('SecurityError')
      },
    })

    expect(() => purgeLocalPostHogState()).not.toThrow()
  })
})
