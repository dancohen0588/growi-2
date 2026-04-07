// growi-frontend/components/dashboard/DashboardHeader.tsx
import Link from 'next/link'
import { auth } from '@/auth'
import { UserMenu } from '@/components/auth/UserMenu'

export async function DashboardHeader() {
  const session = await auth()
  const firstName = session?.user?.firstName ?? 'Jardinier'

  return (
    <header className="sticky top-0 z-40 bg-sand/80 backdrop-blur-md border-b border-forest/10">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-poppins font-bold text-lg text-forest hover:text-forest-light transition-colors"
        >
          Growi 🌱
        </Link>
        <p className="font-raleway text-sm text-forest/70 hidden sm:block">
          Bonjour, <span className="font-semibold text-forest">{firstName}</span> 👋
        </p>
        <UserMenu />
      </div>
    </header>
  )
}
