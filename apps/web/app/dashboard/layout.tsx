// growi-frontend/app/dashboard/layout.tsx
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { DashboardLegalLinks } from '@/components/dashboard/DashboardLegalLinks'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import { ChatPanelProvider } from '@/components/dashboard/chat/ChatPanelProvider'
import { touchActivity } from '@/lib/services/activity.service'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect('/login')

  // Le web s'authentifie par cookie et ne laissait donc aucune trace : ce
  // layout est traversé par toute page du dashboard, c'est le pendant de
  // `getUserId()` pour l'API. L'appel n'attend rien et ne lève jamais.
  if (session.user?.id) touchActivity(session.user.id, 'web')

  return (
    // Le fil de discussion se pose par-dessus n'importe quelle page du
    // dashboard — une recommandation de diagnostic, une carte du calendrier —
    // et son hôte vit donc ici, une fois pour toutes.
    <ChatPanelProvider>
      <div className="flex flex-col min-h-screen bg-sand">
        <DashboardHeader />
        <div className="flex flex-1 max-w-screen-xl mx-auto w-full">
          <DashboardNav />
          <main className="flex-1 p-6 pb-24 md:pb-6 overflow-y-auto">
            {children}
            <DashboardLegalLinks />
          </main>
        </div>
      </div>
    </ChatPanelProvider>
  )
}
