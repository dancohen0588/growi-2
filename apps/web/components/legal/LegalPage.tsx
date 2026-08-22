import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { LEGAL_UPDATED_AT, hasLegalPlaceholders } from '@/lib/legal'

/**
 * Gabarit commun aux pages légales.
 *
 * Un texte de loi se lit en colonne étroite, sans fioriture : la mise en page
 * s'efface derrière le contenu. Les titres et l'espacement sont posés ici pour
 * que les trois pages restent identiques entre elles.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string
  intro?: string
  children: React.ReactNode
}) {
  const incomplete = hasLegalPlaceholders()

  return (
    <div className="bg-sand py-14 md:py-20">
      <article className="mx-auto max-w-3xl px-5">
        <header className="mb-10">
          <h1 className="font-poppins text-3xl font-bold text-forest md:text-4xl">{title}</h1>
          {intro && (
            <p className="mt-3 font-raleway text-forest/70 leading-relaxed">{intro}</p>
          )}
          <p className="mt-4 font-raleway text-xs text-forest/40">
            Dernière mise à jour :{' '}
            {new Date(LEGAL_UPDATED_AT).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </header>

        {/* Tant que l'identité de l'éditeur manque, la page n'est pas conforme :
            mieux vaut le dire en clair que de laisser croire l'inverse. */}
        {incomplete && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-sun bg-sun/15 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-forest" aria-hidden />
            <p className="font-raleway text-sm text-forest">
              <strong className="font-semibold">Document incomplet.</strong> L&apos;identité de
              l&apos;éditeur reste à renseigner dans <code>apps/web/lib/legal.ts</code> avant
              toute mise en ligne publique.
            </p>
          </div>
        )}

        <div className="legal-prose flex flex-col gap-8">{children}</div>

        <footer className="mt-14 border-t border-forest/10 pt-6">
          <p className="font-raleway text-sm text-forest/60">
            Une question sur ce document ?{' '}
            <Link href="/contact" className="text-forest underline underline-offset-2">
              Écris-nous
            </Link>
            .
          </p>
        </footer>
      </article>
    </div>
  )
}

/** Section numérotée d'un document légal. */
export function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-poppins text-xl font-semibold text-forest">{title}</h2>
      <div className="flex flex-col gap-3 font-raleway text-[15px] leading-relaxed text-forest/80">
        {children}
      </div>
    </section>
  )
}

/** Paire libellé / valeur, pour les mentions d'identité. */
export function LegalFacts({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-white p-5 shadow-card sm:grid-cols-[180px_minmax(0,1fr)]">
      {facts.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="font-raleway text-sm font-semibold text-forest/60">{label}</dt>
          <dd className="font-raleway text-[15px] text-forest">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
