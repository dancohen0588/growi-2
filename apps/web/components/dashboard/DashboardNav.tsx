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
  Map,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Les cinq premières entrées sont celles de l'app mobile, dans le même ordre
 * et avec les mêmes icônes — seule la dernière diffère d'un support à l'autre :
 * le diagnostic ici, l'identification photo là-bas. Elles forment aussi la
 * barre du bas en petit écran, d'où la limite de cinq.
 */
const PRIMARY_ITEMS = 5

const navItems = [
  { href: '/dashboard',              label: 'Accueil',       icon: LayoutDashboard },
  { href: '/dashboard/jardin',       label: 'Mon jardin',    icon: Map },
  { href: '/dashboard/plantes',      label: 'Mes plantes',   icon: Leaf },
  { href: '/dashboard/calendrier',   label: 'Calendrier',    icon: CalendarDays },
  { href: '/dashboard/diagnostic',   label: 'Diagnostic IA', icon: Stethoscope },
  { href: '/dashboard/meteo',        label: 'Météo',         icon: CloudSun },
  { href: '/dashboard/marketplace',  label: 'Marketplace',   icon: ShoppingBag },
  { href: '/dashboard/compte',       label: 'Mon compte',    icon: UserCircle },
  { href: '/dashboard/parametres',   label: 'Paramètres',    icon: Settings },
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
        {navItems.map(({ href, label, icon: Icon }, index) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg mx-2 font-raleway text-sm transition-colors',
                // Trait de séparation : au-delà, ce sont des destinations
                // secondaires, absentes de la barre du mobile.
                index === PRIMARY_ITEMS && 'mt-3 border-t border-forest/10 pt-4 rounded-t-none',
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
        {navItems.slice(0, PRIMARY_ITEMS).map(({ href, label, icon: Icon }) => {
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
