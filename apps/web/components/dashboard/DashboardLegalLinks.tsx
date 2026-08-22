import Link from 'next/link'

/**
 * Liens légaux du tableau de bord.
 *
 * Le pied de page marketing ne s'affiche pas dans l'espace connecté : sans
 * cette ligne, les personnes dont on traite les données n'auraient aucun
 * chemin vers la politique de confidentialité. Discret, mais présent.
 */
const LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cgu', label: 'CGU' },
  { href: '/contact', label: 'Contact' },
] as const

export function DashboardLegalLinks() {
  return (
    <nav
      aria-label="Informations légales"
      className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-forest/10 pt-5"
    >
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className="font-raleway text-xs text-forest/45 underline-offset-2 transition-colors hover:text-forest hover:underline"
        >
          {label}
        </Link>
      ))}
      <span className="font-raleway text-xs text-forest/30">
        © {new Date().getFullYear()} Growi
      </span>
    </nav>
  )
}
