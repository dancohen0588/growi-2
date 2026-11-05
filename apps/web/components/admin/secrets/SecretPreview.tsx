import { Clock, Hourglass, Sparkles, TriangleAlert } from 'lucide-react'
import {
  SECRET_EVIDENCES,
  SECRET_EVIDENCE_HINTS,
  type SecretConditions,
  type SecretEvidence,
  type SecretPlanche as SecretPlancheData,
} from '@growi/shared'

import { EvidencePill } from '@/components/admin/secrets/EvidencePill'
import { SecretPlanche } from '@/components/dashboard/secrets/SecretPlanche'
import { describeConditions } from '@/lib/admin/secret-form'

/**
 * Aperçu de la **version enregistrée**, en deux temps : la carte du planning
 * avant dévoilement (accroche + badge — c'est tout ce que le jardinier voit
 * d'abord), puis ce qu'il lit une fois le secret dévoilé.
 *
 * Ce n'est pas le composant de l'app : il en reprend la hiérarchie pour relire
 * le texte dans son contexte, sans dépendre des écrans utilisateur. La planche,
 * elle, est rendue par **le vrai composant** (`SecretPlanche`, disposition
 * compacte) : un dessin ou une légende se relit mieux dans sa case.
 */
export function SecretPreview({
  tip,
  conditions,
  planche,
}: {
  tip: {
    title: string
    teaser: string
    story: string | null
    recipe: string
    ingredients: string[]
    evidence: string
    cautions: string | null
    prepDays: number
    effortMinutes: number | null
  }
  conditions: SecretConditions | null
  planche: SecretPlancheData | null
}) {
  const steps = tip.recipe.split('\n').map((line) => line.trim()).filter(Boolean)
  const hint = SECRET_EVIDENCE_HINTS[tip.evidence as SecretEvidence]
  // Un niveau de preuve inconnu (écrit à la main en base ?) se montre en « Tradition ».
  const evidence: SecretEvidence = (SECRET_EVIDENCES as readonly string[]).includes(tip.evidence)
    ? (tip.evidence as SecretEvidence)
    : 'FOLK'
  const audience = conditions ? describeConditions(conditions) : null

  return (
    <div className="space-y-6">
      <section aria-label="Carte du planning">
        <p className="mb-2 text-xs uppercase tracking-wide text-forest/50">Dans le planning, avant dévoilement</p>
        <div className="rounded-2xl border border-forest/10 bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-poppins text-sm font-semibold text-forest">
              <Sparkles size={16} className="text-sun" aria-hidden /> Secret de jardinier
            </span>
            <EvidencePill evidence={tip.evidence} />
          </div>
          <p className="mt-2 break-words font-raleway text-forest/85">{tip.teaser}</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-hidden>
            <span className="rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white">
              {planche ? 'Ouvrir la planche' : 'Découvrir le secret'}
            </span>
            <span className="rounded-lg border border-forest/15 px-3 py-1.5 text-sm text-forest/70">Pas pour moi</span>
          </div>
        </div>
      </section>

      <section aria-label="Secret dévoilé">
        <p className="mb-2 text-xs uppercase tracking-wide text-forest/50">Une fois dévoilé</p>
        <article className="rounded-2xl border border-forest/10 bg-white p-4">
          <h2 className="break-words font-poppins text-xl font-bold leading-tight text-forest">{tip.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-forest/60">
            <EvidencePill evidence={tip.evidence} />
            {tip.effortMinutes != null && (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} aria-hidden /> {tip.effortMinutes} min
              </span>
            )}
            {tip.prepDays > 0 && (
              <span className="inline-flex items-center gap-1">
                <Hourglass size={13} aria-hidden /> prêt en {tip.prepDays} jour{tip.prepDays > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {hint && <p className="mt-2 text-sm italic text-forest/60">{hint}</p>}

          {tip.story && <p className="mt-4 break-words font-raleway text-forest/85">{tip.story}</p>}

          {tip.ingredients.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-forest">Il te faut</h3>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {tip.ingredients.map((ingredient) => (
                  <li key={ingredient} className="rounded-full bg-sand px-2.5 py-0.5 text-sm text-forest/80">
                    {ingredient}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {planche && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-forest">La planche</h3>
              <SecretPlanche
                planche={planche}
                story={tip.story}
                ingredients={tip.ingredients}
                evidence={evidence}
                cautions={tip.cautions}
                layout="compact"
                headingLevel="h4"
              />
              <p className="mt-2 text-xs text-forest/55">
                La planche remplace la recette en texte dans le calendrier et le grimoire. La recette reste
                obligatoire : elle sert partout où la planche ne s’affiche pas.
              </p>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-forest">{planche ? 'La recette (texte)' : 'La recette'}</h3>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5 font-raleway text-sm text-forest/85">
              {steps.map((step, index) => (
                <li key={index} className="break-words">{step}</li>
              ))}
            </ol>
          </div>

          {tip.cautions && (
            <p className="mt-4 flex gap-2 rounded-xl bg-sun/15 p-3 text-sm text-forest/85">
              <TriangleAlert size={16} className="mt-0.5 shrink-0 text-forest/70" aria-hidden />
              <span className="break-words">{tip.cautions}</span>
            </p>
          )}
        </article>
      </section>

      <section aria-label="À qui il s’adresse">
        <p className="mb-2 text-xs uppercase tracking-wide text-forest/50">À qui il peut être tiré</p>
        {audience === null ? (
          <p className="text-sm text-red-700">
            Conditions illisibles : le planning écarte ce secret tant qu’elles ne sont pas corrigées.
          </p>
        ) : audience.length === 0 ? (
          <p className="text-sm text-forest/70">Toutes les plantes, toute l’année.</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-forest/80">
            {audience.map((line) => (
              <li key={line} className="break-words">{line}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
