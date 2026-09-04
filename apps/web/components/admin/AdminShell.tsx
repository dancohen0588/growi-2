'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Users, Mail, ShieldCheck, ScrollText } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Les cinq destinations du portail, dans l'ordre de la spec. Elles ne bougent
 * pas : la nav est le seul repère d'une interface sans page d'accueil narrative.
 */
const NAV_ITEMS = [
  { href: '/admin', label: 'Tableau de bord', icon: BarChart3 },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
  { href: '/admin/administrateurs', label: 'Administrateurs', icon: ShieldCheck },
  { href: '/admin/journal', label: 'Journal', icon: ScrollText },
] as const

/**
 * `/admin` est un préfixe de toutes les autres routes : sans égalité stricte,
 * le tableau de bord resterait surligné partout.
 */
function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
}

export function AdminNav({ counts }: { counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation administration"
      // En petit écran la nav passe en bandeau défilant au-dessus du contenu :
      // l'admin doit rester utilisable depuis un téléphone, ne serait-ce que
      // pour répondre à un message.
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-forest/10 bg-white p-2',
        'md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:py-6',
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        const count = counts?.[href]

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-3 rounded-lg px-4 py-2.5 font-raleway text-sm transition-colors md:mx-2',
              active
                ? 'bg-lime/20 font-semibold text-forest'
                : 'text-forest/60 hover:bg-sand hover:text-forest',
            )}
          >
            <Icon size={18} aria-hidden />
            <span className="whitespace-nowrap">{label}</span>
            {count !== undefined && count > 0 && (
              <span
                className="ml-auto rounded-full bg-sun px-2 py-0.5 text-xs font-semibold text-forest"
                aria-label={`${count} en attente`}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
