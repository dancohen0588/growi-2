import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, Gift, Lightbulb } from 'lucide-react'
import { SAP_GIFT_REASON_PHRASES, sapGiftReasonSchema, type Quartier } from '@growi/shared'

import { auth } from '@/auth'
import { CommunityDisabled } from '@/components/community/bits'
import { ChallengeCard } from '@/components/community/quartier/ChallengeCard'
import { formatSapDay } from '@/components/dashboard/seve/format'
import { SapDrop } from '@/components/dashboard/seve/SapDrop'
import { SapProgressBar } from '@/components/dashboard/seve/TrunkRings'
import { getQuartier } from '@/lib/services/community/quartier.service'
import { isServiceError } from '@/lib/services/errors'

export const metadata: Metadata = { title: 'Ton quartier — Growi', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * « Ton quartier » — même écran que l'app (`communaute/quartier.tsx`) : le
 * défi de la semaine, ce qui a circulé, les Secrets qui marchent ici et tes
 * mercis. Les gouttes nommées ne sont que les tiennes.
 */
export default async function QuartierPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  let quartier: Quartier
  try {
    quartier = await getQuartier(session.user.id)
  } catch (err) {
    if (isServiceError(err) && err.code === 'FORBIDDEN') return <CommunityDisabled />
    throw err
  }

  const widened = quartier.radiusKm !== quartier.chosenRadiusKm
  const place = quartier.radiusKm === null ? 'dans toute la France' : `à ${quartier.radiusKm} km`
  const who = `${quartier.gardeners} jardinier${quartier.gardeners > 1 ? 's' : ''} ${place}`

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <Link
          href="/dashboard/communaute"
          className="mb-2 inline-flex items-center gap-1 rounded font-raleway text-sm text-forest/70 hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          <ChevronLeft size={16} aria-hidden />
          Communauté
        </Link>
        <h1 className="font-poppins text-[1.75rem] font-bold text-forest">Ton quartier</h1>
        <p className="mt-1 font-raleway text-forest/70">
          {widened
            ? `Ton rayon de ${quartier.chosenRadiusKm} km compte encore peu de jardiniers : ton quartier réunit ${who}.`
            : `Ton quartier réunit ${who}.`}
        </p>
      </div>

      {quartier.challenge ? <ChallengeCard challenge={quartier.challenge} /> : null}
      <Circulation quartier={quartier} />
      <SecretsHere quartier={quartier} />
      <Thanks quartier={quartier} />

      <p className="text-center font-raleway text-sm text-forest/60">
        Pas de classement ici : la sève du quartier monte quand on partage.
      </p>
    </div>
  )
}

function Circulation({ quartier }: { quartier: Quartier }) {
  const { circulation } = quartier
  const tiles = [
    { value: circulation.exchanges, label: circulation.exchanges > 1 ? 'échanges menés à bien' : 'échange mené à bien' },
    { value: circulation.gifts, label: circulation.gifts > 1 ? 'gouttes offertes entre voisins' : 'goutte offerte entre voisins' },
    { value: circulation.secretsTried, label: circulation.secretsTried > 1 ? 'Secrets testés' : 'Secret testé' },
  ]
  return (
    <section aria-labelledby="quartier-circulation" className="flex flex-col gap-3">
      <div>
        <h2 id="quartier-circulation" className="font-poppins text-lg font-semibold text-forest">
          Ce qui a circulé
        </h2>
        <p className="font-raleway text-sm text-forest/60">Ces {circulation.days} derniers jours, dans ton quartier</p>
      </div>
      <ul className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <li key={tile.label} className="flex flex-col gap-1 rounded-xl bg-white p-4 shadow-card">
            <span className="font-poppins text-[28px] font-bold leading-none text-forest">{tile.value}</span>
            <span className="font-raleway text-xs text-forest/60">{tile.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SecretsHere({ quartier }: { quartier: Quartier }) {
  return (
    <section aria-labelledby="quartier-secrets" className="flex flex-col gap-3">
      <h2 id="quartier-secrets" className="font-poppins text-lg font-semibold text-forest">
        Les Secrets qui marchent ici
      </h2>
      {quartier.secrets.length === 0 ? (
        <p className="rounded-xl bg-white p-4 font-raleway text-sm text-forest/60 shadow-card">
          Pas encore assez de retours dans ton quartier. Quand tu testes un Secret, dis si ça a marché : c’est ce qui
          remplit cette liste.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {quartier.secrets.map((secret) => (
            <li key={secret.slug}>
              <Link
                href="/dashboard/grimoire"
                className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card transition hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sun/40 text-forest">
                  <Lightbulb size={18} aria-hidden />
                </span>
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="font-raleway text-sm font-semibold text-forest">{secret.title}</span>
                  <span className="flex items-center gap-2">
                    <span className="flex-1">
                      <SapProgressBar progress={secret.worked / secret.total} />
                    </span>
                    <span className="font-raleway text-xs text-forest/60">
                      {secret.worked} voisin{secret.worked > 1 ? 's' : ''} sur {secret.total}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function reasonPhrase(reason: string): string {
  const parsed = sapGiftReasonSchema.safeParse(reason)
  return parsed.success ? SAP_GIFT_REASON_PHRASES[parsed.data] : ''
}

function Thanks({ quartier }: { quartier: Quartier }) {
  const { thanks } = quartier
  return (
    <section aria-labelledby="quartier-thanks" className="flex flex-col gap-3">
      <div>
        <h2 id="quartier-thanks" className="font-poppins text-lg font-semibold text-forest">
          Tes mercis de la semaine
        </h2>
        {thanks.weekCount > 0 ? (
          <p className="font-raleway text-sm text-forest/60">
            {thanks.weekCount} goutte{thanks.weekCount > 1 ? 's' : ''} offerte{thanks.weekCount > 1 ? 's' : ''} dans ton
            quartier cette semaine
          </p>
        ) : null}
      </div>
      {thanks.mine.length === 0 ? (
        <p className="flex items-center gap-3 rounded-xl bg-white p-4 font-raleway text-sm text-forest/60 shadow-card">
          <Gift size={20} aria-hidden className="shrink-0 text-forest" />
          Pas encore de goutte cette semaine. Une goutte s’offre sous la publication d’un voisin.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {thanks.mine.map((gift, index) => (
            <li key={`${gift.createdAt}-${index}`} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-card">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime font-poppins text-sm font-bold text-forest">
                {gift.handle.charAt(0).toUpperCase()}
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-raleway text-sm text-forest">
                  {gift.direction === 'received' ? (
                    <>
                      <strong>{gift.handle}</strong> t’a offert une goutte {reasonPhrase(gift.reason)}
                    </>
                  ) : (
                    <>
                      Tu as offert une goutte à <strong>{gift.handle}</strong>
                    </>
                  )}
                </span>
                <span className="font-raleway text-xs text-forest/60">
                  {gift.message ? `« ${gift.message} » · ` : ''}
                  {formatSapDay(gift.createdAt)}
                </span>
              </span>
              <SapDrop size={20} veins={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
