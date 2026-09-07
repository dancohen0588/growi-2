import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { CommunityDisabled } from '@/components/community/bits'
import { ListingComposer } from '@/components/community/ListingComposer'
import { getSettings } from '@/lib/services/community/profile.service'

export const metadata: Metadata = {
  title: 'Nouvelle annonce — Growi',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

/**
 * Publier une annonce depuis le web.
 *
 * Une page plutôt qu'une modale : contrairement au mobile, l'écran est assez
 * large pour tout montrer d'un coup, et une adresse propre se partage — c'est
 * là qu'on renvoie depuis les états vides de la bourse.
 *
 * Le profil public est vérifié **avant** d'afficher le formulaire : le service
 * refuserait de toute façon, et faire remplir cinq champs pour se voir opposer
 * un refus à la soumission serait pénible.
 */
export default async function NouvelleAnnoncePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const settings = await getSettings(session.user.id)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/communaute/bourse"
        className="font-raleway text-sm text-forest/60 hover:text-forest"
      >
        ← Retour à la bourse
      </Link>

      <header>
        <h1 className="font-poppins text-2xl font-semibold text-forest">Nouvelle annonce</h1>
        <p className="font-raleway text-sm text-forest/60">
          Des graines en trop, des boutures, une récolte abondante : le voisinage est preneur.
        </p>
      </header>

      {settings.enabled ? <ListingComposer /> : <CommunityDisabled />}
    </div>
  )
}
