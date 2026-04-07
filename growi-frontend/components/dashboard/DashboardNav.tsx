// growi-frontend/components/dashboard/DashboardNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Leaf,
  CalendarDays,
  Stethoscope,
  CloudSun,
  ShoppingBag,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard',            label: 'Accueil',       icon: LayoutDashboard },
  { href: '/dashboard/plantes',    label: 'Mes plantes',   icon: Leaf },
  { href: '/dashboard/calendrier', label: 'Calendrier',    icon: CalendarDays },
  { href: '/dashboard/diagnostic', label: 'Diagnostic IA', icon: Stethoscope },
  { href: '/dashboard/meteo',      label: 'Météo',         icon: CloudSun },
  { href: '/dashboard/marketplace',label: 'Marketplace',   icon: ShoppingBag },
  { href: '/dashboard/compte',     label: 'Mon compte',    icon: UserCircle },
] as const

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <>
      {/* Sidebar — desktop */}
      <nav
        aria-label="Navigation tableau de bord"
        className="hidden md:flex flex-col w-56 shrink-0 py-6 gap-1 border-r border-forest/10 bg-white"
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 font-raleway text-sm transition-colors',
                active
                  ? 'bg-lime/20 text-forest font-semibold'
                  : 'text-forest/60 hover:bg-sand hover:text-forest',
              )}
            >
              <Icon size={18} aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom nav — mobile (5 items max) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-forest/10 flex items-center justify-around px-2 pb-safe"
      >
        {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 px-3 font-raleway text-[10px] transition-colors',
                active ? 'text-forest' : 'text-forest/50',
              )}
            >
              <Icon
                size={22}
                aria-hidden
                className={cn(active && 'stroke-[2.5]')}
              />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
