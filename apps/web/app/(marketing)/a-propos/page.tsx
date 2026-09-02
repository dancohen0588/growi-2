import type { Metadata } from 'next'
import Link from 'next/link'

import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'À propos — Growi',
  description:
    "Pourquoi Growi existe, ce qu'il sait faire aujourd'hui, et où en est le projet.",
}

// Le compteur de l'encyclopédie est le seul chiffre de la page : il est lu en
// base plutôt qu'écrit en dur, pour qu'il ne mente jamais. Même cadence que
// `/encyclopedie`, qui lit le même catalogue.
export const revalidate = 86400 // ISR : 24 h

export default async function AProposPage() {
  const plantCount = await prisma.plantCatalog.count()

  return (
    <div className="bg-sand py-14 md:py-20">
      <article className="mx-auto max-w-3xl px-5">
        <header className="mb-10">
          <h1 className="font-poppins text-3xl font-bold text-forest md:text-4xl">
            À propos de Growi
          </h1>
          <p className="mt-3 font-raleway text-xl leading-relaxed text-forest/70">
            L&apos;assistant intelligent qui t&apos;aide à entretenir ton jardin
            jour après jour, selon la météo et tes plantes.
          </p>
        </header>

        <div className="flex flex-col gap-6 font-raleway leading-relaxed text-forest/80">
          <p>
            Growi est né d&apos;un constat simple : ce qui manque à un jardinier,
            ce n&apos;est ni l&apos;envie ni le savoir-faire, c&apos;est le bon
            moment. Un gel annoncé qu&apos;on apprend le lendemain, une fenêtre de
            semis passée de trois jours, un arrosage fait la veille d&apos;un
            orage. Les applications existantes savent nommer une plante ; aucune
            ne regarde la météo de ta rue pour te dire quoi faire cette semaine.
          </p>

          <p>
            C&apos;est ce que fait Growi. Tu décris ton jardin — son code postal,
            ses zones, tes plantes — et il croise chaque jour leurs besoins avec
            la météo de chez toi pour te proposer les gestes qui comptent :
            arroser ou s&apos;abstenir, tailler, semer, rentrer un citronnier
            avant une nuit à &minus;2 °C. Il t&apos;aide à identifier une plante
            en photo, à diagnostiquer une feuille qui jaunit, à tenir le journal
            de ce que tu as fait. Son encyclopédie compte {plantCount} espèces,
            en accès libre et sans compte.
          </p>

          <p>
            Le parti pris est de ne montrer que ce qui existe. Growi ne fait pas
            tout : il ne vend rien, ne met en relation avec personne, ne remplace
            pas l&apos;œil d&apos;un pépiniériste. Ce que tu lis sur ce site
            correspond à ce que tu trouveras dans l&apos;app — quand une
            fonctionnalité n&apos;est pas prête, elle n&apos;est pas annoncée.
          </p>

          <p>
            Le projet est en bêta, développé en France. Il est gratuit, sans
            carte bancaire : disponible sur le web aujourd&apos;hui, sur iPhone
            bientôt. Une version pour les professionnels des espaces verts —
            syndics, collectivités, paysagistes — est à l&apos;étude ; si
            c&apos;est ton métier, parle-nous-en, ça nous aide à la dessiner.
          </p>

          <p>
            Une question, une remarque, une plante qui manque à
            l&apos;encyclopédie ?{' '}
            <Link href="/contact" className="text-forest underline underline-offset-2">
              Écris-nous
            </Link>
            . Chaque retour de cette période est lu et sert à décider de la
            suite.
          </p>
        </div>

        <footer className="mt-12 flex flex-wrap gap-4 border-t border-forest/10 pt-8">
          <Link
            href="/register"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-lime px-6 font-poppins font-semibold text-forest shadow-cta transition-colors hover:bg-lime-hover"
          >
            Créer mon jardin
          </Link>
          <Link
            href="/fonctionnalites"
            className="inline-flex min-h-[44px] items-center rounded-lg border-2 border-forest px-6 font-poppins font-semibold text-forest transition-colors hover:bg-forest/5"
          >
            Voir les fonctionnalités
          </Link>
        </footer>
      </article>
    </div>
  )
}
