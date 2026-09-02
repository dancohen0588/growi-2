import Link from 'next/link'
import { Button } from '@/components/ui/button'

/**
 * Les deux badges App Store et Google Play pointaient vers « / » : l'app
 * n'est publiée sur aucune des deux boutiques. Ils reviendront quand ce sera
 * le cas ; d'ici là, un seul bouton, qui mène quelque part.
 */
export function FinalCTA() {
  return (
    <section
      id="app-mobile"
      className="bg-gradient-to-r from-lime to-forest py-20 md:py-28"
      aria-label="Créer un compte Growi"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="font-poppins font-bold text-white text-3xl md:text-[2.5rem] leading-tight mb-4">
          Rejoins la communauté des jardiniers connectés.
        </h2>
        <p className="font-raleway text-white/80 text-lg mb-10">
          Gratuit pour commencer. Disponible sur le web aujourd&apos;hui, sur
          iPhone bientôt.
        </p>

        <div className="flex justify-center">
          <Button variant="primary" size="lg" asChild>
            <Link href="/register">Créer mon jardin</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
