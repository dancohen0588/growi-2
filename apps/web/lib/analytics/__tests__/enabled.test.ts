import { describe, expect, it } from 'vitest'

import { analyticsEnabled } from '@/lib/analytics/enabled'

describe('analyticsEnabled', () => {
  it('reste faux en local, même avec une clé dans .env', () => {
    // Le cas qui compte : une clé traîne, et pourtant rien ne doit partir.
    // Sans ce garde-fou, les parcours de développement se mêleraient à
    // l'entonnoir d'activation des testeurs.
    expect(analyticsEnabled({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_test' })).toBe(false)
  })

  it('reste faux sans clé, même sur Vercel', () => {
    expect(analyticsEnabled({ VERCEL_ENV: 'production' })).toBe(false)
  })

  it('est vrai en preview et en production, clé posée', () => {
    expect(analyticsEnabled({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_test', VERCEL_ENV: 'preview' })).toBe(
      true,
    )
    expect(analyticsEnabled({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_test', VERCEL_ENV: 'production' })).toBe(
      true,
    )
  })

  it('lit la variable publique, seule disponible dans le navigateur', () => {
    expect(
      analyticsEnabled({ NEXT_PUBLIC_POSTHOG_KEY: 'phc_test', NEXT_PUBLIC_VERCEL_ENV: 'preview' }),
    ).toBe(true)
  })
})
