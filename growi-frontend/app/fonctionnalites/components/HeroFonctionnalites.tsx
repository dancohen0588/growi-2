import Link from 'next/link'
import { Button } from '@/components/ui/button'

const anchorLinks = [
  { href: '#cartographie', label: 'Cartographie' },
  { href: '#assistant',    label: 'Assistant IA' },
  { href: '#diagnostic',   label: 'Diagnostic' },
  { href: '#calendrier',   label: 'Calendrier' },
  { href: '#marketplace',  label: 'Marketplace' },
  { href: '#premium',      label: 'Premium' },
]

export function HeroFonctionnalites() {
  return (
    <section
      className="bg-gradient-to-br from-sand via-sand to-lime/30 py-20 md:py-28"
      aria-label="Présentation des fonctionnalités"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center gap-8">

        <span className="inline-block font-poppins font-semibold text-sm text-lime bg-forest/90 px-4 py-1.5 rounded-full">
          Ce que Growi fait pour toi
        </span>

        <h1 className="font-poppins font-bold text-forest text-4xl md:text-[3.25rem] leading-tight max-w-3xl">
          Tout ce dont ton jardin a besoin, au bon moment
        </h1>

        <p className="font-raleway text-forest/70 text-xl max-w-2xl leading-relaxed">
          De la cartographie de tes espaces à la mise en relation avec des pros,
          Growi t&apos;accompagne à chaque saison — sans que tu aies à tout gérer seul.
        </p>

        <Button variant="primary" size="lg" asChild>
          <Link href="/tarifs">Essaie gratuitement</Link>
        </Button>

        <nav aria-label="Navigation rapide dans la page" className="flex flex-wrap justify-center gap-2 mt-2">
          {anchorLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-forest/10 shadow-card font-raleway font-semibold text-sm text-forest hover:bg-lime/10 hover:border-lime transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}
