import { SECRET_VERDICTS, SECRET_VERDICT_LABELS } from '@growi/shared'

import type { TipStats } from '@/lib/services/secrets-admin.service'

/**
 * Une proportion se lit avec son dénominateur nommé : « 3 / 4 tirages · 75 % »
 * ne se confond pas avec une tendance, « 75 % » seul si.
 */
export function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)} %` : '—'
}

export function Ratio({ part, whole, unit }: { part: number; whole: number; unit: string }) {
  return (
    <span className="whitespace-nowrap">
      {part}
      <span className="text-forest/45">
        {' '}
        / {whole}
        {unit && ` ${unit}`}
        {whole > 0 && ` · ${pct(part, whole)}`}
      </span>
    </span>
  )
}

/** Les verdicts en une ligne compacte, pour la liste. */
export function VerdictSummary({ stats }: { stats: TipStats }) {
  if (stats.answered === 0) return <span className="text-forest/30">—</span>
  return (
    <span className="whitespace-nowrap" title={`${stats.answered} réponse(s) sur ${stats.tried} essai(s)`}>
      <span className="text-forest">{stats.verdicts.WORKED} oui</span>
      <span className="text-forest/45"> · {stats.verdicts.MEH} bof · {stats.verdicts.FAILED} non</span>
    </span>
  )
}

/**
 * Le devenir d'un secret, sur sa fiche. Les unités sont dites parce qu'elles
 * diffèrent : un tirage est une semaine d'un jardin, un dévoilement ou un refus
 * un compte, un essai un geste sur une plante.
 */
export function TipStatsPanel({ stats }: { stats: TipStats }) {
  return (
    <section aria-labelledby="secret-stats" className="mb-6 rounded-2xl border border-forest/10 bg-white p-4">
      <h2 id="secret-stats" className="font-poppins text-base font-semibold text-forest">
        Ce qu’il est devenu
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tiré" hint="semaines-jardins où il a été le secret de la semaine">
          {stats.picked}
        </Stat>
        <Stat label="Dévoilé" hint="comptes, rapportés aux tirages">
          <Ratio part={stats.revealed} whole={stats.picked} unit="tirages" />
        </Stat>
        <Stat label="Essayé" hint="gestes « Je tente », rapportés aux tirages">
          <Ratio part={stats.tried} whole={stats.picked} unit="tirages" />
        </Stat>
        <Stat label="Refusé" hint="« Pas pour moi », rapporté aux tirages">
          <Ratio part={stats.dismissed} whole={stats.picked} unit="tirages" />
        </Stat>
      </dl>

      <div className="mt-4 border-t border-forest/10 pt-3">
        <p className="text-sm text-forest/70">
          Verdicts : <Ratio part={stats.answered} whole={stats.tried} unit="essais ont répondu" />
        </p>
        {stats.answered > 0 && (
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
            {SECRET_VERDICTS.map((verdict) => (
              <li key={verdict} className="text-forest/80">
                {SECRET_VERDICT_LABELS[verdict]} —{' '}
                <Ratio part={stats.verdicts[verdict]} whole={stats.answered} unit="réponses" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Stat({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-sand p-3">
      <dt className="text-xs uppercase tracking-wide text-forest/55">{label}</dt>
      <dd className="mt-1 font-poppins text-lg font-semibold text-forest">{children}</dd>
      <dd className="text-xs text-forest/50">{hint}</dd>
    </div>
  )
}
