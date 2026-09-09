import { describe, expect, it } from 'vitest'

// `scrubEvent` est testé dans `@growi/shared`, d'où il vient : le mobile
// applique les mêmes règles à partir du même code.
import {
  baseSentryOptions,
  resolveEnvironment,
  resolveRelease,
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
