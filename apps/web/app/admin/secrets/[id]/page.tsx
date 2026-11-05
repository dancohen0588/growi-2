import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { secretConditionsSchema, type SecretConditions } from '@growi/shared'

import {
  deleteGardenTipAction,
  publishGardenTipAction,
  unpublishGardenTipAction,
  updateGardenTipAction,
} from '@/app/actions/admin/secrets'
import { ActionButton } from '@/components/admin/ActionButton'
import { DateCell, PageHeader, Pill } from '@/components/admin/bits'
import { GardenTipEditor } from '@/components/admin/secrets/GardenTipEditor'
import { SecretPreview } from '@/components/admin/secrets/SecretPreview'
import { TipStatsPanel } from '@/components/admin/secrets/TipStats'
import { requireAdmin } from '@/lib/admin/auth'
import { isServiceError } from '@/lib/services/errors'
import { getTipForAdmin, statsForSlug, tipUsage } from '@/lib/services/secrets-admin.service'

export const dynamic = 'force-dynamic'

export default async function AdminSecretPage({ params }: { params: { id: string } }) {
  await requireAdmin()

  let tip
  try {
    tip = await getTipForAdmin(params.id)
  } catch (error) {
    if (isServiceError(error) && error.code === 'NOT_FOUND') notFound()
    throw error
  }

  const [stats, usage] = await Promise.all([statsForSlug(tip.slug), tipUsage(tip.slug)])
  const published = tip.status === 'PUBLISHED'
  const used = usage.picks + usage.trials + usage.userTips > 0

  // Des conditions illisibles en base : le planning écarte le secret. On les
  // montre telles quelles, et le formulaire repart d'une page blanche — les
  // enregistrer les remplacera.
  const parsedConditions = secretConditionsSchema.safeParse(tip.conditions ?? {})
  const conditions: SecretConditions | null = parsedConditions.success ? parsedConditions.data : null

  const bound = {
    update: updateGardenTipAction.bind(null, tip.id),
    publish: publishGardenTipAction.bind(null, tip.id),
    unpublish: unpublishGardenTipAction.bind(null, tip.id),
    remove: deleteGardenTipAction.bind(null, tip.id),
  }

  return (
    <>
      <Link
        href={`/admin/secrets?statut=${published ? 'publies' : 'brouillons'}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-forest/60 hover:text-forest"
      >
        <ArrowLeft size={15} aria-hidden /> Tous les secrets
      </Link>

      <PageHeader
        title={tip.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={published ? 'positive' : 'warning'}>{published ? 'Publié' : 'Brouillon'}</Pill>
            <span className="break-all font-mono text-xs">{tip.slug}</span>
            <span>
              · modifié le <DateCell value={tip.updatedAt} withTime />
            </span>
          </span>
        }
        actions={
          <>
            {published ? (
              <ActionButton
                label="Dépublier"
                action={bound.unpublish}
                confirm={{
                  title: 'Dépublier ce secret ?',
                  body: 'Il ne sera plus tiré et sort du grimoire. Les essais en cours gardent leurs suites (« c’est prêt », « Ça a marché ? »).',
                  cta: 'Dépublier',
                }}
              />
            ) : (
              <ActionButton
                label="Publier"
                action={bound.publish}
                confirm={{
                  title: 'Publier ce secret ?',
                  body: 'Il peut être tiré dès la semaine en cours, pour les plantes qui répondent à ses conditions. C’est la version enregistrée qui part.',
                  cta: 'Publier',
                }}
              />
            )}
            {!published && !used && (
              <ActionButton
                label="Supprimer"
                tone="danger"
                action={bound.remove}
                confirm={{
                  title: 'Supprimer définitivement ?',
                  body: 'Ce brouillon n’a jamais été proposé. Le journal garde la trace de la suppression, pas le texte.',
                  cta: 'Supprimer',
                }}
              />
            )}
          </>
        }
      />

      {!published && used && (
        <p className="mb-6 rounded-2xl border border-forest/10 bg-white p-4 text-sm text-forest/70">
          Ce brouillon a déjà été proposé à des jardiniers : il ne se supprime pas, son identifiant figure dans
          leur journal. Rester en brouillon suffit à ne plus le tirer.
        </p>
      )}

      {!conditions && (
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Conditions illisibles en base — le planning écarte ce secret.</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(tip.conditions, null, 2)}
          </pre>
          <p className="mt-2">Le formulaire repart sans condition : l’enregistrer remplacera ce contenu.</p>
        </section>
      )}

      <TipStatsPanel stats={stats} />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-forest/10 bg-white p-4">
          <GardenTipEditor
            mode="edit"
            tip={{
              slug: tip.slug,
              title: tip.title,
              teaser: tip.teaser,
              story: tip.story,
              recipe: tip.recipe,
              ingredients: tip.ingredients,
              evidence: tip.evidence,
              cautions: tip.cautions,
              prepDays: tip.prepDays,
              effortMinutes: tip.effortMinutes,
              cooldownDays: tip.cooldownDays,
              conditions: conditions ?? {},
            }}
            action={bound.update}
          />
        </div>

        <aside aria-label="Aperçu" className="min-w-0 rounded-2xl border border-forest/10 bg-sand p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-forest/50">Aperçu de la version enregistrée</p>
          <SecretPreview tip={tip} conditions={conditions} />
        </aside>
      </div>
    </>
  )
}
