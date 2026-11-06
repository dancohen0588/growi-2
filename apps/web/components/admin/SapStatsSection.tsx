import {
  QUARTIER_CHALLENGES,
  SAP_HOME_THEME_LABELS,
  SAP_KIND_LABELS,
} from '@growi/shared'

import { KpiCard } from '@/components/admin/KpiCard'
import { CHART_COLORS, WeeklyChart } from '@/components/admin/WeeklyChart'
import type { SapStats } from '@/lib/services/admin-sap-stats.service'

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : '—')

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-forest/10 bg-white p-5">
      <h3 className="mb-3 font-raleway text-sm font-semibold text-forest/70">{title}</h3>
      {children}
    </div>
  )
}

/** Une barre horizontale, proportionnelle au plus grand de la liste. */
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <li className="flex items-center gap-3 text-sm text-forest">
      <span className="w-40 shrink-0 truncate">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sand-dark">
        <span className="block h-full rounded-full bg-forest-light" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums">{value}</span>
    </li>
  )
}

/**
 * La section « Sève » du tableau de bord (phase 8). Pas de groupe témoin
 * (décision du 06/11/2026) : la comparaison se fait avant/après le premier
 * gain écrit, et la page dit ce que cela ne prouve pas.
 */
export function SapStatsSection({ stats }: { stats: SapStats | null }) {
  if (!stats) {
    return (
      <p className="rounded-2xl border border-forest/10 bg-white p-5 text-sm text-forest/60">
        Indisponible pour l’instant — la lecture de la sève a échoué (voir les journaux du serveur).
      </p>
    )
  }

  const { gesturesPerActive, j30 } = stats
  const ringsMax = Math.max(0, ...stats.rings.map((row) => row.accounts))
  const themesMax = Math.max(0, ...stats.themes.map((row) => row.accounts))
  const gainsMax = Math.max(0, ...stats.gains30d.map((row) => row.amount))

  return (
    <>
      <p className="mb-4 max-w-3xl text-sm text-forest/60">
        {stats.launchedAt
          ? `Lancée le ${formatDay(stats.launchedAt)} (premier gain écrit). `
          : 'Aucun gain écrit pour l’instant : rien à comparer. '}
        Pas de groupe témoin : on compare les quatre semaines entières avant le lancement et depuis. La saison, et ce
        qui a été livré en même temps, jouent aussi — un écart n’est pas une preuve.
      </p>

      <div className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="Comptes avec de la sève" value={stats.accountsWithSap} />
        <KpiCard label="Sève distribuée" value={stats.totalSap} />
        <KpiCard
          label="Gestes par actif et par semaine"
          value={gesturesPerActive.after ?? '—'}
          hint={
            gesturesPerActive.before === null
              ? 'Pas de semaine entière avant le lancement à comparer.'
              : `${gesturesPerActive.before.toLocaleString('fr-FR')} sur les quatre semaines avant le lancement${gesturesPerActive.after === null ? ' — pas encore de semaine entière depuis.' : '.'}`
          }
        />
        <KpiCard
          label="Rétention J30"
          value={pct(j30.after.retained, j30.after.cohort)}
          hint={`Revus entre J28 et J35 : ${j30.after.retained}/${j30.after.cohort} depuis le lancement, ${j30.before.retained}/${j30.before.cohort} (${pct(j30.before.retained, j30.before.cohort)}) avant. Cohortes de plus de 35 jours seulement.`}
        />
      </div>

      <Panel title="Gestes notés et comptes actifs, par semaine">
        <WeeklyChart
          weeks={stats.gesturesByWeek.map((point) => point.week)}
          series={[
            { label: 'Gestes notés', color: CHART_COLORS.lime, points: stats.gesturesByWeek.map((point) => point.gestures) },
            { label: 'Comptes actifs', color: CHART_COLORS.forest, points: stats.gesturesByWeek.map((point) => point.active) },
          ]}
          caption="12 dernières semaines — hors notes de santé"
        />
      </Panel>

      <Panel title="Secrets essayés, annonces terminées et gouttes offertes, par semaine">
        <WeeklyChart
          weeks={stats.secretTrialsByWeek.map((point) => point.week)}
          series={[
            { label: 'Secrets essayés', color: CHART_COLORS.sun, points: stats.secretTrialsByWeek.map((point) => point.value) },
            { label: 'Annonces terminées', color: CHART_COLORS.forest, points: stats.listingsDoneByWeek.map((point) => point.value) },
            { label: 'Gouttes offertes', color: CHART_COLORS.lime, points: stats.giftsByWeek.map((point) => point.value) },
          ]}
          caption="12 dernières semaines"
        />
      </Panel>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Retours sur un Secret" value={stats.secretFeedbacks} hint="Depuis le lancement (crédités de sève)." />
        <KpiCard label="Comptes ayant offert une goutte" value={stats.giftGivers} />
        <KpiCard
          label="Thème d’Accueil choisi"
          value={stats.themes.filter((row) => row.theme !== 'classique').reduce((sum, row) => sum + row.accounts, 0)}
          hint="Comptes ayant quitté l’Accueil classique."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Gains des 30 derniers jours, par type">
          {stats.gains30d.length === 0 ? (
            <p className="text-sm text-forest/55">Aucun gain sur la période.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.gains30d.map((gain) => (
                <Bar
                  key={gain.kind}
                  label={`${SAP_KIND_LABELS[gain.kind]} (${gain.count})`}
                  value={gain.amount}
                  max={gainsMax}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Comptes par cernes formés">
          <ul className="flex flex-col gap-2">
            {stats.rings.map((row) => (
              <Bar key={row.rings} label={row.rings === 0 ? 'Aucun cerne' : `${row.rings} cerne${row.rings > 1 ? 's' : ''}`} value={row.accounts} max={ringsMax} />
            ))}
          </ul>
        </Panel>

        <Panel title="Thèmes d’Accueil">
          <ul className="flex flex-col gap-2">
            {stats.themes.map((row) => (
              <Bar
                key={row.theme}
                label={row.theme === 'classique' ? 'Classique' : SAP_HOME_THEME_LABELS[row.theme]}
                value={row.accounts}
                max={themesMax}
              />
            ))}
          </ul>
        </Panel>

        <Panel title="Défis du quartier clos">
          {stats.quartier.length === 0 ? (
            <p className="text-sm text-forest/55">Aucun défi clos pour l’instant — le premier l’est le lundi matin.</p>
          ) : (
            <table className="w-full text-left text-sm text-forest">
              <thead className="text-xs uppercase tracking-wide text-forest/50">
                <tr>
                  <th className="pb-2 font-semibold">Semaine</th>
                  <th className="pb-2 font-semibold">Défi</th>
                  <th className="pb-2 text-right font-semibold">Participants</th>
                  <th className="pb-2 text-right font-semibold">Comptes d’un quartier qui a réussi</th>
                </tr>
              </thead>
              <tbody>
                {stats.quartier.map((row) => (
                  <tr key={row.week} className="border-t border-forest/10">
                    <td className="whitespace-nowrap py-2 tabular-nums">{row.week}</td>
                    <td className="py-2">{capitalize(QUARTIER_CHALLENGES.find((c) => c.slug === row.slug)?.unit.many ?? row.slug)}</td>
                    <td className="py-2 text-right tabular-nums">{row.participants}</td>
                    <td className="py-2 text-right tabular-nums">{row.reached}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  )
}
