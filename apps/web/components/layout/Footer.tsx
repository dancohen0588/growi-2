import Link from 'next/link'
import { Share2, Globe, Play } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const productLinks = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/tarifs',          label: 'Premium' },
  { href: '/',                label: 'App' },
  { href: '/tarifs',          label: 'Tarifs' },
]

const companyLinks = [
  { href: '/a-propos', label: 'À propos' },
  { href: '/blog',     label: 'Blog' },
  { href: '/pro',      label: 'Pro' },
  { href: '/contact',  label: 'Contact' },
]

const legalLinks = [
  { href: '/', label: 'Mentions légales' },
  { href: '/', label: 'RGPD' },
  { href: '/', label: 'CGU' },
]

export function Footer() {
  return (
    <footer className="bg-forest text-white" aria-label="Pied de page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Col 1: Brand */}
          <div className="flex flex-col gap-4">
            <Link href="/" className="font-poppins font-bold text-xl">
              Growi 🌱
            </Link>
            <p className="font-raleway text-white/70 text-sm leading-relaxed">
              Ton compagnon de croissance intelligent.
            </p>
            <div className="flex gap-4 mt-2">
              <a
                href="/"
                aria-label="Instagram"
                className="text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -ml-3"
              >
                <Share2 className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="/"
                aria-label="LinkedIn"
                className="text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Globe className="h-5 w-5" aria-hidden="true" />
              </a>
              <a
                href="/"
                aria-label="YouTube"
                className="text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Play className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white/50 mb-4">
              Produit
            </h3>
            <ul className="flex flex-col gap-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-raleway text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Company */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white/50 mb-4">
              Entreprise
            </h3>
            <ul className="flex flex-col gap-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-raleway text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Legal */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white/50 mb-4">
              Légal
            </h3>
            <ul className="flex flex-col gap-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-raleway text-white/70 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-10 bg-white/10" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50 font-raleway">
          <Badge className="bg-forest-light text-white border-white/20">
            Greentech France 🌿
          </Badge>
          <span>Made with 💚 in France</span>
          <span>© 2026 Growi</span>
        </div>
      </div>
    </footer>
  )
}
