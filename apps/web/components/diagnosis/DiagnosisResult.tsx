'use client'

import {
  DIAGNOSIS_CONFIDENCE_LABELS,
  DIAGNOSIS_LIKELIHOOD_LABELS,
  DIAGNOSIS_PRIORITY_LABELS,
  HEALTH_STATUS_LABELS,
  type DiagnosisPriority,
  type DiagnosisSuccess,
  type HealthStatus,
} from '@growi/shared'
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'

/**
 * Affichage d'un diagnostic abouti.
 *
 * L'ordre suit celui de la spec : état estimé, observations, causes,
 * recommandations, suivi — du constat vers l'action. Le bloc de confirmation
 * vient en dernier, quand l'utilisateur a lu de quoi décider.
 */

/** Couleurs des trois états, alignées sur `healthStatusConfig` de la fiche plante. */
const STATUS_STYLES: Record<HealthStatus, { banner: string; icon: string }> = {
  HEALTHY: { banner: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: '✅' },
  WARNING: { banner: 'bg-amber-50 border-amber-200 text-amber-800', icon: '⚠️' },
  CRITICAL: { banner: 'bg-red-50 border-red-200 text-red-800', icon: '🚨' },
}

const PRIORITY_STYLES: Record<DiagnosisPriority, string> = {
  urgent: 'bg-red-100 text-red-700',
  soon: 'bg-sun/25 text-forest',
  watch: 'bg-lime/20 text-forest',
}

export interface DiagnosisResultProps {
  result: DiagnosisSuccess
  photoUrl: string | null
  /** État actuellement enregistré sur la fiche — sert à décider de la confirmation. */
  currentHealthStatus: HealthStatus
  /** Absent en lecture d'historique : on n'y propose pas de réappliquer. */
  onApply?: () => void
  onDismissApply?: () => void
  isApplying?: boolean
  /** Passe à `true` une fois le statut appliqué, ou si le diagnostic l'était déjà. */
  applied?: boolean
  applyError?: string | null
  /** Absent en lecture seule ; la planification reste possible depuis l'historique. */
  onPlan?: () => void
  isPlanning?: boolean
  /** Date de planification — non nulle, le bouton cède la place à son état accompli. */
  tasksPlannedAt?: string | null
  planError?: string | null
}

export function DiagnosisResult({
  result,
  photoUrl,
  currentHealthStatus,
  onApply,
  onDismissApply,
  isApplying = false,
  applied = false,
  applyError = null,
  onPlan,
  isPlanning = false,
  tasksPlannedAt = null,
  planError = null,
}: DiagnosisResultProps) {
  const status = STATUS_STYLES[result.status]
  // On ne propose la mise à jour que si elle change vraiment quelque chose.
  const suggestsChange = result.status !== currentHealthStatus

  return (
    <div className="flex flex-col gap-5">
      {photoUrl && (
        /* Data URL en cours d'analyse, ou URL Supabase : `next/image` refuse
           les data URL et n'apporterait rien sur une photo déjà compressée
           à 1920 px par le navigateur. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Photo analysée"
          className="w-full h-48 object-cover rounded-2xl bg-sand"
        />
      )}

      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${status.banner}`}>
        <span className="text-2xl leading-none" aria-hidden>
          {status.icon}
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-poppins font-bold text-lg">
            {HEALTH_STATUS_LABELS[result.status]}
          </p>
          <p className="font-raleway text-sm opacity-90">{result.summary}</p>
          <p className="font-raleway text-xs opacity-70">
            {DIAGNOSIS_CONFIDENCE_LABELS[result.confidence]}
          </p>
        </div>
      </div>

      {result.observations.length > 0 && (
        <Section title="Ce que l'on observe">
          <ul className="flex flex-col gap-1.5">
            {result.observations.map((observation, i) => (
              <li key={i} className="font-raleway text-sm text-forest/80 flex gap-2">
                <span className="text-forest/40" aria-hidden>
                  •
                </span>
                {observation}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.probableCauses.length > 0 && (
        <Section title="Causes probables">
          <ul className="flex flex-col gap-3">
            {result.probableCauses.map((cause, i) => (
              <li key={i} className="rounded-xl bg-sand p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-poppins font-semibold text-sm text-forest">
                    {cause.label}
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 font-poppins text-[11px] font-semibold text-forest/70">
                    {DIAGNOSIS_LIKELIHOOD_LABELS[cause.likelihood]}
                  </span>
                </div>
                <p className="font-raleway text-sm text-forest/75 leading-relaxed">
                  {cause.explanation}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.recommendations.length > 0 && (
        <Section title="Que faire">
          <ul className="flex flex-col gap-2">
            {result.recommendations.map((reco, i) => (
              <li
                key={i}
                className="rounded-xl border border-forest/10 p-3 flex items-start gap-3"
              >
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-poppins text-[11px] font-semibold ${PRIORITY_STYLES[reco.priority]}`}
                >
                  {DIAGNOSIS_PRIORITY_LABELS[reco.priority]}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-raleway text-sm text-forest/85">{reco.action}</span>
                  <span className="font-raleway text-xs text-forest/50">{reco.timeframe}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.followUp && (
        <p className="rounded-xl bg-lime/15 p-3 font-raleway text-sm text-forest/80 flex items-start gap-2">
          <CalendarClock size={16} className="shrink-0 mt-0.5 text-forest/60" aria-hidden />
          {result.followUp}
        </p>
      )}

      {applied ? (
        <p className="rounded-xl bg-lime/20 border border-lime/40 px-4 py-3 font-raleway text-sm text-forest inline-flex items-center gap-2">
          <Check size={16} aria-hidden />
          L&apos;état de la plante a été mis à jour en «&nbsp;
          {HEALTH_STATUS_LABELS[result.status]}&nbsp;».
        </p>
      ) : (
        onApply &&
        suggestsChange && (
          <div className="rounded-2xl border border-forest/15 bg-white p-4 flex flex-col gap-3">
            <p className="font-raleway text-sm text-forest/85">
              Mettre à jour l&apos;état de la plante en «&nbsp;
              <strong className="font-semibold">
                {HEALTH_STATUS_LABELS[result.status]}
              </strong>
              &nbsp;»&nbsp;? Le geste sera noté dans son journal d&apos;entretien.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={onApply}
                disabled={isApplying}
                className="flex-1 rounded-xl bg-forest text-white font-poppins font-semibold text-sm px-4 py-2.5 hover:bg-forest/90 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isApplying ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : (
                  <Check size={16} aria-hidden />
                )}
                {isApplying ? 'Mise à jour…' : 'Mettre à jour'}
              </button>
              <button
                type="button"
                onClick={onDismissApply}
                disabled={isApplying}
                className="rounded-xl bg-white border border-forest/20 text-forest font-poppins font-semibold text-sm px-4 py-2.5 hover:bg-sand transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70"
              >
                <X size={16} aria-hidden />
                Ignorer
              </button>
            </div>
            {applyError && (
              <p className="font-raleway text-sm text-red-700">{applyError}</p>
            )}
          </div>
        )
      )}

      {/* Planification — après la mise à jour du statut, dans le même bloc
          d'actions : on constate d'abord, on agit ensuite. */}
      {result.recommendations.length > 0 &&
        (tasksPlannedAt ? (
          <p className="rounded-xl bg-lime/20 border border-lime/40 px-4 py-3 font-raleway text-sm text-forest inline-flex items-center gap-2">
            <CalendarCheck size={16} aria-hidden />
            {result.recommendations.length} action
            {result.recommendations.length > 1 ? 's' : ''} planifiée
            {result.recommendations.length > 1 ? 's' : ''}
          </p>
        ) : (
          onPlan && (
            <div className="rounded-2xl border border-forest/15 bg-white p-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={onPlan}
                disabled={isPlanning}
                className="rounded-xl bg-lime text-forest font-poppins font-semibold text-sm px-4 py-2.5 hover:bg-lime/80 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPlanning ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                ) : (
                  <CalendarPlus size={16} aria-hidden />
                )}
                {isPlanning ? 'Planification…' : 'Planifier ces actions'}
              </button>
              <p className="font-raleway text-xs text-forest/55 text-center">
                Elles s&apos;ajouteront à ton calendrier et à ta liste du jour.
              </p>
              {planError && <p className="font-raleway text-sm text-red-700">{planError}</p>}
            </div>
          )
        ))}

      <p className="font-raleway text-xs text-forest/45 flex items-center gap-1.5">
        <Sparkles size={12} aria-hidden />
        Diagnostic généré par IA — en cas de doute, demandez l&apos;avis d&apos;un
        professionnel.
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-poppins font-semibold text-sm text-forest">{title}</h3>
      {children}
    </section>
  )
}
