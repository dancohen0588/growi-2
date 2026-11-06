import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  CalendarCheck,
  Droplet,
  Gift,
  Image as ImageIcon,
  Leaf,
  Lightbulb,
  Lock,
  MessageCircle,
} from 'lucide-react'
import {
  formatSapAmount,
  SAP_KINDS,
  SAP_RULE_DISPLAY,
  SAP_RULES,
  sapRingName,
  sapRingsLabel,
  sapRingsLine,
  sapRingThreshold,
  type SapKind,
  type SapRuleGroup,
  type SapSummary,
} from '@growi/shared'

import { auth } from '@/auth'
import { SapDrop } from '@/components/dashboard/seve/SapDrop'
import { SapHistory } from '@/components/dashboard/seve/SapHistory'
import { SapProgressBar, TrunkRings } from '@/components/dashboard/seve/TrunkRings'
import { serializeSapEntry, serializeSapSummary } from '@/lib/api/serializers'
import { getSapSummary, listSapHistory } from '@/lib/services/sap.service'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Ta sève — Growi', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * « Ta sève » — la coupe du tronc, les cernes, le barème et l'historique.
 * Même écran que l'app mobile (`app/(tabs)/accueil/seve.tsx`).
 *
 * Rien n'y compare à personne, et le bloc forest le dit en clair. Les
 * récompenses de cernes et les chiffres du mois des maquettes viendront avec
 * leur phase : l'écran n'annonce rien qui n'existe pas encore.
 */
export default async function SevePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  const userId = session.user.id

  const [summaryRecord, history] = await Promise.all([getSapSummary(userId), listSapHistory(userId, null)])
  const summary = serializeSapSummary(summaryRecord)

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-poppins text-[1.75rem] font-bold text-forest">Ta sève</h1>
        <p className="mt-1 font-raleway text-forest/70">
          Chaque geste utile à ton jardin ou à tes voisins la fait monter.
        </p>
      </div>

      <TrunkBlock summary={summary} />
      <RingsList summary={summary} />
      <RulesSection />

      <section aria-labelledby="sap-history-title" className="flex flex-col gap-3">
        <h2 id="sap-history-title" className="font-poppins text-lg font-semibold text-forest">
          Dernières gouttes
        </h2>
        <SapHistory initial={history.items.map(serializeSapEntry)} initialCursor={history.nextCursor} />
      </section>
    </div>
  )
}

function TrunkBlock({ summary }: { summary: SapSummary }) {
  const { total, rings } = summary

  return (
    <section
      aria-label="Ta sève"
      className="flex flex-col items-center gap-5 rounded-3xl bg-forest px-6 py-7 sm:flex-row sm:items-center sm:gap-8 sm:px-8"
    >
      <TrunkRings
        count={rings.count}
        progress={rings.progress}
        size={220}
        halo
        label={sapRingsLabel(rings)}
        className="shrink-0"
      />

      <div className="flex w-full flex-1 flex-col gap-4">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <p className="m-0 flex items-baseline gap-2">
            <span className="font-poppins text-[44px] font-bold leading-none text-sand">{total}</span>
            <span className="font-raleway font-medium text-[#E6F0DA]">de sève</span>
          </p>
          <p className="m-0 font-raleway text-sm font-semibold text-lime">{sapRingsLine(rings)}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <SapProgressBar progress={rings.progress} onDark />
          <p className="m-0 flex items-center justify-between gap-2 font-raleway text-xs text-[#E6F0DA]">
            <span>{rings.floor}</span>
            <span className="text-center">
              <strong className="font-bold text-sand">encore {rings.remaining}</strong> pour le{' '}
              {sapRingName(rings.count + 1).toLowerCase()}
            </span>
            <span>{rings.next}</span>
          </p>
        </div>

        <p className="m-0 flex items-start gap-2.5 rounded-xl bg-forest-light/60 p-3 font-raleway text-sm text-[#E6F0DA]">
          <Lock size={18} aria-hidden className="mt-0.5 shrink-0 text-lime" />
          Ta sève n’est visible que par toi. Pas de classement : seulement ton jardin qui grandit.
        </p>
      </div>
    </section>
  )
}

type RingState = 'formed' | 'forming' | 'upcoming'

function RingsList({ summary }: { summary: SapSummary }) {
  const { rings } = summary
  const items = Array.from({ length: rings.count + 2 }, (_, index) => {
    const n = index + 1
    const state: RingState = n <= rings.count ? 'formed' : n === rings.count + 1 ? 'forming' : 'upcoming'
    return { n, state, threshold: sapRingThreshold(n) }
  })

  return (
    <section aria-labelledby="sap-rings-title" className="flex flex-col gap-3">
      <h2 id="sap-rings-title" className="font-poppins text-lg font-semibold text-forest">
        Tes cernes
      </h2>
      <ol className="flex flex-col gap-2">
        {items.map(({ n, state, threshold }) => (
          <li
            key={n}
            className={cn(
              'flex items-center gap-3 rounded-xl bg-white px-4 py-3',
              state === 'forming' ? 'border-2 border-forest' : 'shadow-card',
              state === 'upcoming' && 'opacity-70',
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-full font-poppins text-sm font-bold',
                state === 'formed' && 'bg-forest text-lime',
                state === 'forming' && 'bg-sun text-forest',
                state === 'upcoming' && 'bg-sand-dark text-forest/60',
              )}
            >
              {state === 'upcoming' ? <Lock size={16} aria-label="À venir" /> : n}
            </span>
            <span className="flex flex-1 flex-col">
              <span className="font-raleway font-semibold text-forest">
                {sapRingName(n)} · {threshold}
              </span>
              <span className="font-raleway text-xs text-forest/60">
                {state === 'formed'
                  ? 'Formé'
                  : state === 'forming'
                    ? `Encore ${rings.remaining} de sève`
                    : 'À venir'}
              </span>
            </span>
            {state === 'forming' ? (
              <span className="rounded-full bg-sun px-2.5 py-1 font-raleway text-xs font-bold text-forest">
                En cours
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

const RULE_ICONS: Record<SapKind, React.ReactNode> = {
  care: <Droplet size={20} aria-hidden />,
  task_on_time: <CalendarCheck size={20} aria-hidden />,
  plant_added: <Leaf size={20} aria-hidden />,
  secret_feedback: <Lightbulb size={20} aria-hidden />,
  post: <ImageIcon size={20} aria-hidden />,
  comment: <MessageCircle size={20} aria-hidden />,
  listing_done: <Gift size={20} aria-hidden />,
  gift_received: <SapDrop size={20} veins={false} />,
}

const GROUPS: { group: SapRuleGroup; title: string }[] = [
  { group: 'jardin', title: 'Au jardin' },
  { group: 'partage', title: 'En partageant' },
]

/** Le barème, tiré de `SAP_RULES` : l'écran ne peut pas promettre plus que le serveur. */
function RulesSection() {
  return (
    <section aria-labelledby="sap-rules-title" className="flex flex-col gap-3">
      <h2 id="sap-rules-title" className="font-poppins text-lg font-semibold text-forest">
        Faire monter ta sève
      </h2>
      <div className="grid gap-5 rounded-2xl bg-white p-5 shadow-card sm:grid-cols-2">
        {GROUPS.map(({ group, title }) => (
          <div key={group} className="flex flex-col gap-3">
            <h3 className="font-raleway text-xs font-bold uppercase tracking-widest text-forest/60">{title}</h3>
            <ul className="flex flex-col gap-3">
              {SAP_KINDS.filter((kind) => SAP_RULE_DISPLAY[kind].group === group).map((kind) => {
                const rule = SAP_RULE_DISPLAY[kind]
                return (
                  <li key={kind} className="flex items-center gap-3 text-forest">
                    {RULE_ICONS[kind]}
                    <span className="flex flex-1 flex-col">
                      <span className="font-raleway text-sm font-semibold">{rule.title}</span>
                      {rule.hint ? <span className="font-raleway text-xs text-forest/60">{rule.hint}</span> : null}
                    </span>
                    <span className="min-w-[44px] rounded-full bg-lime/40 px-2.5 py-1 text-center font-poppins text-sm font-bold">
                      {formatSapAmount(SAP_RULES[kind].amount)}
                      <span className="sr-only"> de sève</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
