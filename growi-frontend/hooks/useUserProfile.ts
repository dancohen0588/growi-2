// growi-frontend/hooks/useUserProfile.ts
'use client'

import { useState, useEffect } from 'react'
import type { UserProfile, AlertConfig } from '@/lib/mock-users'
import { defaultAlertConfig } from '@/lib/mock-users'

const STORAGE_KEY = 'growi_user_profile'

interface InitialSession {
  firstName: string
  email: string
}

export function useUserProfile(initial?: InitialSession) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setProfile(JSON.parse(stored) as UserProfile)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    } else if (initial) {
      // First visit: seed from session data
      const seed: UserProfile = {
        firstName: initial.firstName,
        lastName: '',
        email: initial.email,
        alertConfig: defaultAlertConfig,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      setProfile(seed)
    }
    setIsLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => {
      const base = prev ?? ({} as UserProfile)
      const updated: UserProfile = { ...base, ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      // TODO: Replace with PATCH /api/user/profile
      window.dispatchEvent(
        new CustomEvent('growi:profile-updated', { detail: updated }),
      )
      return updated
    })
  }

  const updateAlerts = (updates: Partial<AlertConfig>) => {
    setProfile((prev) => {
      if (!prev) return prev
      const updated: UserProfile = {
        ...prev,
        alertConfig: { ...prev.alertConfig, ...updates },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const resetAlerts = () => {
    setProfile((prev) => {
      if (!prev) return prev
      const updated: UserProfile = { ...prev, alertConfig: defaultAlertConfig }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  return { profile, isLoading, updateProfile, updateAlerts, resetAlerts }
}
