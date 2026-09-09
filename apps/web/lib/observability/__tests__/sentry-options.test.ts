import { describe, expect, it } from 'vitest'

import {
  baseSentryOptions,
  resolveEnvironment,
  resolveRelease,
  scrubEvent,
  tracesSampleRate,
} from '@/lib/observability/sentry-options'

describe('resolveEnvironment', () => {
  it('reconnaît la production et la preview Vercel', () => {
    expect(resolveEnvironment({ VERCEL_ENV: 'production' })).toBe('production')
    expect(resolveEnvironment({ VERCEL_ENV: 'preview' })).toBe('preview')
  })

  it('préfère la variable publique, seule disponible dans le navigateur', () => {
    expect(resolveEnvironment({ NEXT_PUBLIC_VERCEL_ENV: 'preview', VERCEL_ENV: 'production' })).toBe(
      'preview',
    )
  })

  it("hors Vercel, c'est du développement", () => {
    expect(resolveEnvironment({})).toBe('development')
    expect(resolveEnvironment({ VERCEL_ENV: 'autre' })).toBe('development')
  })
})

describe('resolveRelease', () => {
  it('reprend le SHA du commit injecté par Vercel', () => {
    expect(resolveRelease({ VERCEL_GIT_COMMIT_SHA: 'abc123' })).toBe('abc123')
    expect(resolveRelease({ NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: 'def456' })).toBe('def456')
    expect(resolveRelease({})).toBeUndefined()
  })
})

describe('tracesSampleRate', () => {
  it('trace tout en preview, la moitié en production', () => {
    expect(tracesSampleRate('preview')).toBe(1)
    expect(tracesSampleRate('production')).toBe(0.5)
  })
})

describe('baseSentryOptions', () => {
  it('reste désactivé en local, même si un DSN traîne dans .env', () => {
    const options = baseSentryOptions({ NEXT_PUBLIC_SENTRY_DSN: 'https://x@sentry.io/1' })
    expect(options.enabled).toBe(false)
  })

  it('reste désactivé sans DSN, même sur Vercel', () => {
    expect(baseSentryOptions({ VERCEL_ENV: 'production' }).enabled).toBe(false)
  })

  it('est actif en preview, avec la release et le marqueur de surface', () => {
    const options = baseSentryOptions({
      NEXT_PUBLIC_SENTRY_DSN: 'https://x@sentry.io/1',
      VERCEL_ENV: 'preview',
      VERCEL_GIT_COMMIT_SHA: 'abc123',
    })
    expect(options.enabled).toBe(true)
    expect(options.environment).toBe('preview')
    expect(options.release).toBe('abc123')
    expect(options.initialScope.tags.surface).toBe('web')
    expect(options.sendDefaultPii).toBe(false)
  })
})

describe('scrubEvent', () => {
  it("retire le cookie et l'autorisation des en-têtes", () => {
    const event = scrubEvent({
      request: {
        headers: {
          cookie: 'session=secret',
          Authorization: 'Bearer eyJ…',
          'user-agent': 'Growi/1.0',
        },
      },
    })

    expect(event.request?.headers).toEqual({ 'user-agent': 'Growi/1.0' })
  })

  it('remplace la photo du corps de requête par un marqueur', () => {
    const event = scrubEvent({
      request: { data: { imageBase64: 'data:image/jpeg;base64,AAAA', gardenId: 'g1' } },
    })

    expect(event.request?.data).toEqual({ imageBase64: '[image]', gardenId: 'g1' })
  })

  it("écarte un corps sérialisé qui contient l'image", () => {
    const event = scrubEvent({ request: { data: '{"imageBase64":"data:image/jpeg;base64,AAAA"}' } })
    expect(event.request?.data).toBe('[image]')
  })

  it('filtre e-mail, mot de passe et jetons, à toute profondeur', () => {
    const event = scrubEvent({
      extra: {
        email: 'jardinier@exemple.fr',
        payload: { passwordHash: '$2a$…', accessToken: 'eyJ…', plantsCount: 3 },
      },
      contexts: { compte: { user_email: 'jardinier@exemple.fr', plan: 'FREE' } },
    })

    expect(event.extra).toEqual({
      email: '[filtré]',
      payload: { passwordHash: '[filtré]', accessToken: '[filtré]', plantsCount: 3 },
    })
    expect(event.contexts).toEqual({ compte: { user_email: '[filtré]', plan: 'FREE' } })
  })

  it('laisse passer un événement sans rien de sensible', () => {
    const event = scrubEvent({ extra: { route: '/api/v1/plants/[id]', plantsCount: 12 } })
    expect(event.extra).toEqual({ route: '/api/v1/plants/[id]', plantsCount: 12 })
  })

  it('survit à une structure cyclique', () => {
    const cyclic: Record<string, unknown> = { name: 'boucle' }
    cyclic.self = cyclic

    expect(() => scrubEvent({ extra: { cyclic } })).not.toThrow()
  })
})
