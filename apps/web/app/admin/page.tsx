import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

import { DateCell, PageHeader, Pill } from '@/components/admin/bits'
import { KpiCard } from '@/components/admin/KpiCard'
import { CHART_COLORS, WeeklyChart } from '@/components/admin/WeeklyChart'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminStats, STATS_CACHE_SECONDS } from '@/lib/services/admin-stats.service'

export const dynamic = 'force-dynamic'

const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)} %` : '—'

export default async function AdminHomePage() {
  await requireAdmin()

  const stats = await getAdminStats()
  const { accounts, active, retention, garden, ai, ops } = stats

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={
          <>
            Calculé à la demande, mis en cache {STATS_CACHE_SECONDS / 60} minutes. Dernier calcul{' '}
            <DateCell value={new Date(stats.generatedAt)} withTime />.
          </>
        }
        actions={
          <a
            href="https://vercel.com/analytics"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-4 py-2 text-sm font-medium text-forest hover:bg-sand"
          >
            Trafic du site
            <ExternalLink size={14} aria-hidden />
          </a>
        }
      />

      {/* ─── Comptes ─────────────────────────────────────────────────── */}
      <Section title="Comptes">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Inscriptions cette semaine"
            value={accounts.signupsThisWeek}
            previous={accounts.signupsLastWeek}
          />
          <KpiCard label="Comptes au total" value={accounts.total} />
          <KpiCard
            label="Onboardés"
            value={accounts.onboarded}
            hint={`${pct(accounts.onboarded, accounts.total)} des comptes`}
          />
          <KpiCard
            label="Connexion"
            value={`${accounts.withPassword} mdp`}
            hint={
              accounts.byProvider.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {accounts.byProvider.map((p) => (
                    <Pill key={p.provider}>
                      {p.provider} · {p.count}
                    </Pill>
                  ))}
                </span>
              ) : (
                'Aucun compte social'
              )
            }
          />
        </div>

        <Panel title="Inscriptions par semaine">
          <WeeklyChart
            weeks={accounts.signupsByWeek.map((p) => p.week)}
            series={[
              {
                label: 'Inscriptions',
                color: CHART_COLORS.lime,
                points: accounts.signupsByWeek.map((p) => p.value),
              },
            ]}
            caption="26 dernières semaines, semaines ISO en UTC"
          />
        </Panel>
      </Section>

      {/* ─── Actifs ──────────────────────────────────────────────────── */}
      <Section title="Utilisateurs actifs">
        <p className="mb-4 max-w-prose text-sm text-forest/55">
          Un utilisateur est <em>actif</em> un jour donné s’il a émis au moins une requête
          authentifiée. Une visite du site public sans connexion n’en est pas une : c’est du
          trafic, et il se lit chez Vercel.
          {active.since ? (
            <>
              {' '}
              La trace d’activité a commencé le <strong>{active.since}</strong> — rien n’existe
              avant.
            </>
          ) : (
            <> Aucune trace n’a encore été enregistrée.</>
          )}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Actifs aujourd’hui"
            value={active.dau.web + active.dau.mobile}
            hint={`${active.dau.web} web · ${active.dau.mobile} mobile`}
          />
          <KpiCard
            label="Actifs sur 7 jours"
            value={active.wau.web + active.wau.mobile}
            hint={`${active.wau.web} web · ${active.wau.mobile} mobile`}
          />
          <KpiCard
            label="Actifs sur 30 jours"
            value={active.mau.web + active.mau.mobile}
            hint={`${active.mau.web} web · ${active.mau.mobile} mobile`}
          />
        </div>

        <Panel title="Actifs par semaine et par surface">
          <WeeklyChart
            weeks={active.byWeek.map((p) => p.week)}
            series={[
              {
                label: 'Site web',
                color: CHART_COLORS.lime,
                points: active.byWeek.map((p) => p.web),
              },
              {
                label: 'Application mobile',
                color: CHART_COLORS.forest,
                points: active.byWeek.map((p) => p.mobile),
              },
            ]}
            caption="12 dernières semaines"
            emptyHint="La trace d’activité vient d’être mise en place : les courbes se rempliront à mesure."
          />
        </Panel>

        <Panel title="Rétention des cohortes">
          <p className="mb-3 text-sm text-forest/55">
            Part des comptes créés une semaine donnée, revus au moins une fois entre la semaine
            suivante et la quatrième. Les cohortes trop récentes sont exclues : leur fenêtre
            d’observation n’est pas close.
          </p>
          {retention.length === 0 ? (
            <p className="rounded-xl border border-dashed border-forest/15 p-8 text-center text-sm text-forest/50">
              Pas encore de cohorte observable.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {retention.map((point) => (
                <li key={point.week} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-forest/55">{point.week}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-forest/10">
                    <span
                      className="block h-full rounded-full bg-lime"
                      style={{
                        width: `${point.cohort > 0 ? (point.retained / point.cohort) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span className="w-28 shrink-0 text-right tabular-nums text-forest/70">
                    {point.retained}/{point.cohort} · {pct(point.retained, point.cohort)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>

      {/* ─── Jardins ─────────────────────────────────────────────────── */}
      <Section title="Jardins et plantes">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Jardins" value={garden.gardens} />
          <KpiCard label="Plantes" value={garden.plants} />
          <KpiCard
            label="Plantes par compte onboardé"
            value={garden.plantsPerOnboarded.toFixed(1)}
          />
        </div>

        <Panel title="Plantes ajoutées par semaine">
          <WeeklyChart
            weeks={garden.plantsByWeek.map((p) => p.week)}
            series={[
              {
                label: 'Plantes',
                color: CHART_COLORS.forest,
                points: garden.plantsByWeek.map((p) => p.value),
              },
            ]}
            caption="26 dernières semaines"
          />
        </Panel>
      </Section>

      {/* ─── IA ──────────────────────────────────────────────────────── */}
      <Section title="Usage de l’IA">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard label="Diagnostics" value={ai.diagnoses} />
          <KpiCard label="Messages envoyés au chat" value={ai.chatMessages} />
          <KpiCard
            label="Identifications sans compte"
            value={ai.anonymousIdentifications}
            hint="Cumul des quotas journaliers anonymes."
          />
        </div>

        {ai.byModel.length > 0 && (
          <Panel title="Modèle ayant produit les diagnostics">
            <p className="mb-3 text-sm text-forest/55">
              Le repli d’un modèle Gemini à l’autre se fait en silence. Une part de repli qui
              grimpe signale une saturation du modèle principal.
            </p>
            <ul className="flex flex-wrap gap-2">
              {ai.byModel.map((m) => (
                <li key={m.model}>
                  <Pill>
                    {m.model} · {m.count} ({pct(m.count, ai.diagnoses)})
                  </Pill>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title="Diagnostics et messages par semaine">
          <WeeklyChart
            weeks={ai.diagnosesByWeek.map((p) => p.week)}
            series={[
              {
                label: 'Diagnostics',
                color: CHART_COLORS.sun,
                points: ai.diagnosesByWeek.map((p) => p.value),
              },
              {
                label: 'Messages chat',
                color: CHART_COLORS.forest,
                points: ai.chatByWeek.map((p) => p.value),
              },
            ]}
            caption="12 dernières semaines"
          />
        </Panel>
      </Section>

      {/* ─── Exploitation ────────────────────────────────────────────── */}
      <Section title="Notifications et support">
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Comptes avec un appareil"
            value={ops.usersWithPush}
            hint={
              ops.pushByPlatform.length > 0 ? (
                <span className="flex flex-wrap gap-1.5">
                  {ops.pushByPlatform.map((p) => (
                    <Pill key={p.platform}>
                      {p.platform} · {p.count}
                    </Pill>
                  ))}
                </span>
              ) : (
                'Aucun jeton push enregistré.'
              )
            }
          />
          <KpiCard
            label="Messages non traités"
            value={ops.newMessages}
            hint={
              ops.newMessages > 0 ? (
                <Link href="/admin/messages?statut=new" className="underline hover:no-underline">
                  Ouvrir la boîte
                </Link>
              ) : (
                'Rien en attente.'
              )
            }
          />
          <KpiCard
            label="Délai médian de réponse"
            value={ops.medianReplyHours !== null ? `${ops.medianReplyHours.toFixed(1)} h` : '—'}
            hint="Entre la réception et la première réponse."
          />
        </div>
      </Section>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 font-poppins text-lg font-semibold text-forest">{title}</h2>
      {children}
    </section>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-forest/10 bg-white p-5">
      <h3 className="mb-3 font-raleway text-sm font-semibold text-forest/70">{title}</h3>
      {children}
    </div>
  )
}
