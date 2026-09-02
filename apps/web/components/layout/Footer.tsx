import Link from 'next/link'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const productLinks = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/encyclopedie',    label: 'Encyclopédie' },
  { href: '/blog',            label: 'Blog' },
  { href: '/#app-mobile',     label: 'App mobile' },
]

const companyLinks = [
  { href: '/a-propos', label: 'À propos' },
  { href: '/contact',  label: 'Contact' },
]

const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite',  label: 'Confidentialité' },
  { href: '/cgu',              label: 'CGU' },
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
              L&apos;assistant intelligent qui t&apos;aide à entretenir ton jardin
              jour après jour, selon la météo et tes plantes.
            </p>
            {/* Les trois icônes sociales pointaient toutes vers « / » : il n'y a
                pas de comptes à lier. Elles reviendront quand il y en aura. */}
          </div>

          {/* Col 2: Product */}
          <div>
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white mb-4">
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
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white mb-4">
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
            <h3 className="font-poppins font-semibold text-sm uppercase tracking-wider text-white mb-4">
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

        {/* Blanc à 70 % sur forest : 5,16:1, au-dessus du seuil AA de 4,5:1
            que le texte de 14 px impose. En dessous de /70 on repasse sous la
            barre — /60 ne donne que 4,24:1. */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/70 font-raleway">
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
