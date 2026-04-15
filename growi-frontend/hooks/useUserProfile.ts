// growi-frontend/hooks/useUserProfile.ts
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { UserProfile, AlertConfig } from '@/lib/user-types'
import { defaultAlertConfig } from '@/lib/user-types'

interface InitialSession {
  firstName: string
  email: string
}

export function useUserProfile(initial?: InitialSession) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch('/api/user/profile', { cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = (await res.json()) as UserProfile
        if (!cancelled) setProfile(data)
      } catch (err) {
        console.error('[useUserProfile] load failed:', err)
        if (!cancelled && initial) {
          // Fallback to a session-derived stub so the form is at least usable
          setProfile({
            firstName: initial.firstName,
            lastName: '',
            email: initial.email,
            alertConfig: defaultAlertConfig,
          })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [initial?.email])

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile>): Promise<{ error?: string }> => {
      // Strip out alertConfig — that's handled by updateAlerts
      const { alertConfig: _ignored, ...profileUpdates } = updates
      void _ignored
      try {
        const res = await fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileUpdates),
        })
        const data = await res.json()
        if (!res.ok) return { error: data?.error ?? 'Erreur de mise à jour' }
        setProfile(data as UserProfile)
        window.dispatchEvent(
          new CustomEvent('growi:profile-updated', { detail: data }),
        )
        return {}
      } catch (err) {
        console.error('[useUserProfile] updateProfile failed:', err)
        return { error: 'Erreur réseau lors de la sauvegarde.' }
      }
    },
    [],
  )

  const updateAlerts = useCallback(
    async (updates: Partial<AlertConfig>): Promise<{ error?: string }> => {
      try {
        const res = await fetch('/api/user/alerts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const data = await res.json()
        if (!res.ok) return { error: data?.error ?? 'Erreur de mise à jour' }
        setProfile((prev) =>
          prev ? { ...prev, alertConfig: data as AlertConfig } : prev,
        )
        return {}
      } catch (err) {
        console.error('[useUserProfile] updateAlerts failed:', err)
        return { error: 'Erreur réseau lors de la sauvegarde.' }
      }
    },
    [],
  )

  const resetAlerts = useCallback(async (): Promise<{ error?: string }> => {
    return updateAlerts(defaultAlertConfig)
  }, [updateAlerts])

  return { profile, isLoading, updateProfile, updateAlerts, resetAlerts }
}
