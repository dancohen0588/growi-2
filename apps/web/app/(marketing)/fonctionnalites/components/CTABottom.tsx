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
          Tout ce dont ton jardin a besoin,<br />au bon moment.
        </h2>
        {/* « +12 000 jardiniers » et « 14 jours d'essai Premium » décrivaient
            une base installée et une offre payante qui n'existent ni l'une ni
            l'autre. Le second bouton menait à `/tarifs`, page supprimée. */}
        <p className="font-raleway text-forest/80 text-xl max-w-xl leading-relaxed">
          Gratuit pour commencer. Deux minutes pour créer ton jardin.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="forest" size="lg" asChild>
            <Link href="/register">Créer mon jardin</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
