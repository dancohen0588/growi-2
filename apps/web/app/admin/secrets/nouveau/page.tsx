import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { createGardenTipAction } from '@/app/actions/admin/secrets'
import { PageHeader } from '@/components/admin/bits'
import { GardenTipEditor } from '@/components/admin/secrets/GardenTipEditor'
import { requireAdmin } from '@/lib/admin/auth'

export const dynamic = 'force-dynamic'

/**
 * Un secret naît en brouillon. Sa fiche, ouverte après la création, montre
 * l'aperçu et le bouton « Publier ».
 */
export default async function NewSecretPage() {
  await requireAdmin()

  return (
    <>
      <Link
        href="/admin/secrets?statut=brouillons"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-forest/60 hover:text-forest"
      >
        <ArrowLeft size={15} aria-hidden /> Tous les secrets
      </Link>

      <PageHeader
        title="Nouveau secret"
        description="Tutoiement, aucune promesse au-delà du niveau de preuve, une précaution dès qu’un geste peut abîmer."
      />

      <div className="max-w-3xl rounded-2xl border border-forest/10 bg-white p-4">
        <GardenTipEditor
          mode="create"
          tip={{
            slug: '',
            title: '',
            teaser: '',
            story: null,
            recipe: '',
            ingredients: [],
            evidence: 'FOLK',
            cautions: null,
            prepDays: 0,
            effortMinutes: null,
            cooldownDays: 120,
            conditions: {},
          }}
          action={createGardenTipAction}
        />
      </div>
    </>
  )
}
