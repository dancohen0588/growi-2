// growi-frontend/components/dashboard/parametres/ParametresLayout.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Bell } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfilForm } from './ProfilForm'
import { AlertesForm } from './AlertesForm'
import { useUserProfile } from '@/hooks/useUserProfile'

interface ParametresLayoutProps {
  initialSession: { firstName: string; email: string }
}

type TabValue = 'profil' | 'alertes'

export function ParametresLayout({ initialSession }: ParametresLayoutProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabValue>('profil')
  const { profile, isLoading, updateProfile, updateAlerts, resetAlerts } =
    useUserProfile(initialSession)

  // Sync with URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'alertes') setActiveTab('alertes')
  }, [])

  function handleTabChange(value: string) {
    const tab = value as TabValue
    setActiveTab(tab)
    router.replace(`/dashboard/parametres#${tab}`, { scroll: false })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-poppins font-bold text-[1.75rem] text-forest">Paramètres</h1>
        <p className="font-raleway text-forest/70 mt-1">
          Gère ton profil et tes préférences de notifications.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="border-b border-forest/10 bg-transparent w-full justify-start rounded-none p-0 h-auto gap-1">
          <TabsTrigger
            value="profil"
            className="flex items-center gap-2 px-4 py-2.5 font-raleway text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-lime data-[state=active]:text-forest data-[state=active]:font-semibold text-forest/60 hover:text-forest transition-colors bg-transparent shadow-none"
          >
            <User size={15} aria-hidden />
            Mon profil
          </TabsTrigger>
          <TabsTrigger
            value="alertes"
            className="flex items-center gap-2 px-4 py-2.5 font-raleway text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-lime data-[state=active]:text-forest data-[state=active]:font-semibold text-forest/60 hover:text-forest transition-colors bg-transparent shadow-none"
          >
            <Bell size={15} aria-hidden />
            Mes alertes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="mt-6 animate-in fade-in-0 duration-200">
          {profile ? (
            <ProfilForm
              profile={profile}
              isLoading={isLoading}
              updateProfile={updateProfile}
            />
          ) : (
            !isLoading && (
              <div className="bg-white rounded-2xl shadow-card p-8 text-center space-y-4">
                <p className="font-raleway text-forest/70">
                  Ton profil n&apos;est pas encore configuré.
                </p>
                <button
                  onClick={() =>
                    updateProfile({
                      firstName: initialSession.firstName,
                      lastName: '',
                      email: initialSession.email,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 font-raleway font-semibold text-sm text-forest transition-colors hover:bg-lime/80"
                >
                  Créer mon profil
                </button>
              </div>
            )
          )}
        </TabsContent>

        <TabsContent value="alertes" className="mt-6 animate-in fade-in-0 duration-200">
          {profile ? (
            <AlertesForm
              profile={profile}
              isLoading={isLoading}
              updateAlerts={updateAlerts}
              resetAlerts={resetAlerts}
            />
          ) : (
            !isLoading && (
              <div className="bg-white rounded-2xl shadow-card p-8 text-center">
                <p className="font-raleway text-forest/70">
                  Configure d&apos;abord ton profil pour accéder aux alertes.
                </p>
              </div>
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
