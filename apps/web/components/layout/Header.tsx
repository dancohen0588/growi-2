'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { LayoutDashboard, Menu } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/auth/UserMenu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'

/**
 * Premium n'est volontairement pas ici : l'offre s'atteint depuis le footer et
 * depuis le cœur de la page Fonctionnalités, pas depuis la navigation globale.
 */
const navLinks = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/encyclopedie',    label: 'Encyclopédie' },
  { href: '/blog',            label: 'Blog' },
  { href: '/pro',             label: 'Pro' },
  { href: '/contact',         label: 'Contact' },
]

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { status } = useSession()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-md bg-sand/80 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="font-poppins font-bold text-xl text-forest hover:text-forest-light transition-colors"
          >
            Growi 🌱
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Navigation principale">
            {/* CTA principal : le retour à l'app prime sur le reste du menu. */}
            {status === 'authenticated' && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-lime px-4 py-2 font-poppins font-semibold text-sm text-forest shadow-cta transition-all duration-200 hover:bg-lime-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              >
                <LayoutDashboard size={16} aria-hidden />
                Tableau de bord
              </Link>
            )}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-raleway text-forest/70 hover:text-forest transition-colors text-sm"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {status === 'loading' && (
              <div className="h-9 w-9 rounded-full bg-forest/10 animate-pulse" aria-hidden />
            )}
            {status === 'unauthenticated' && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Connexion</Link>
              </Button>
            )}
            {status === 'authenticated' && <UserMenu />}
          </div>

          {/* Mobile burger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <button
                className="p-2 text-forest hover:bg-forest/10 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-sand">
              <nav
                className="flex flex-col gap-6 mt-8"
                aria-label="Navigation mobile"
              >
                {status === 'authenticated' && (
                  <Button variant="primary" size="default" className="w-full" asChild>
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      <LayoutDashboard size={18} aria-hidden />
                      Tableau de bord
                    </Link>
                  </Button>
                )}
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-raleway text-forest text-lg hover:text-forest-light transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                {status === 'unauthenticated' && (
                  <Link
                    href="/login"
                    className="font-raleway text-forest text-lg hover:text-forest-light transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    Connexion
                  </Link>
                )}
                {status === 'authenticated' && (
                  <div className="flex items-center gap-3">
                    <UserMenu />
                  </div>
                )}
                <Button variant="primary" size="default" className="mt-4 w-full">
                  Télécharger l&apos;app
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
