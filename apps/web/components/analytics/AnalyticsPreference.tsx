'use client'

import { useEffect } from 'react'

import { useAnalytics } from '@/lib/analytics/client'

/**
 * Applique le choix du compte quant à l'analyse d'usage.
 *
 * Le refus est stocké **sur le compte**, pas sur l'appareil : quelqu'un qui
 * refuse depuis son téléphone doit aussi être respecté sur le web, et sur un
 * navigateur où il vient de se connecter pour la première fois.
 *
 * Monté par le layout du dashboard, seul endroit du web où l'on est
 * authentifié — et le seul, donc, où l'analyse rattache quoi que ce soit à
 * une personne (`person_profiles: 'identified_only'`).
 */
export function AnalyticsPreference({ optOut }: { optOut: boolean }) {
  const analytics = useAnalytics()

  useEffect(() => {
    if (optOut) analytics.optOut()
    else analytics.optIn()
  }, [analytics, optOut])

  return null
}
