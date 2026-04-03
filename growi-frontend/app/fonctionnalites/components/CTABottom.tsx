import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTABottom() {
  return (
    <section
      aria-label="Appel à l'action final"
      className="bg-gradient-to-r from-lime to-forest py-20 md:py-28"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-8 text-center">
        <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl max-w-2xl leading-tight">
          Prêt à te (re)connecter à ton jardin ?
        </h2>
        <p className="font-raleway text-forest/80 text-xl max-w-xl leading-relaxed">
          Rejoins les +12 000 jardiniers qui utilisent Growi chaque semaine.
          Commence gratuitement, sans carte bancaire.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="forest" size="lg" asChild>
            <Link href="/tarifs">Essaie gratuitement</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="border-forest/40 text-forest hover:bg-forest/10"
          >
            <Link href="/tarifs">Voir les tarifs</Link>
          </Button>
        </div>
        <p className="font-raleway text-sm text-forest/60">
          14 jours d&apos;essai Premium offerts · Sans engagement · Résiliation en 1 clic
        </p>
      </div>
    </section>
  )
}
