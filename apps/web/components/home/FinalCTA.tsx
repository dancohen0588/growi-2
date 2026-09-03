import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BetaIosForm } from '@/components/home/BetaIosForm'

/**
 * Les deux badges App Store et Google Play pointaient vers « / » : l'app n'est
 * publiée sur aucune des deux boutiques. Ils reviendront quand ce sera le cas ;
 * d'ici là, une liste d'attente, qui est honnête et utile.
 *
 * L'ancre `app-mobile` est celle que vise le lien « App mobile » du footer.
 */
export function FinalCTA() {
  return (
    <section
      id="app-mobile"
      className="scroll-mt-20 bg-gradient-to-r from-lime to-forest py-20 md:py-28"
      aria-label="Créer un compte Growi"
    >
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-4 font-poppins text-3xl font-bold leading-tight text-white md:text-[2.5rem]">
          Rejoins la communauté des jardiniers connectés.
        </h2>
        <p className="mb-10 font-raleway text-lg text-white/85">
          Gratuit pour commencer. Disponible sur le web aujourd&apos;hui, sur
          iPhone bientôt.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-start">
          <Button variant="primary" size="lg" asChild>
            <Link href="/register">Créer mon jardin</Link>
          </Button>
          <BetaIosForm />
        </div>
      </div>
    </section>
  )
}
