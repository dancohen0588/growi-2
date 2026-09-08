'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import type { DiagnosisReview, TaskReviewItem, TaskVerdict } from '@growi/shared'

/** « 8 sept. » — la date d'un retrait, sans année ni heure. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

interface TaskReviewSectionProps {
  plantId: string
  diagnosisId: string
  /** Les tâches à retirer, remontées au parent pour l'appel de planification. */
  onChange: (supersede: string[]) => void
  /** Déjà planifié : il n'y a plus de verdict à rendre, seulement à relire. */
  readOnly?: boolean
}

/**
 * « Tes actions en cours sur cette plante » — la revue d'avant planification.
 *
 * Deux diagnostics à une semaine d'écart sur le même rosier donnaient deux jeux
 * de tâches qui coexistaient, y compris quand le second disait « plante
 * saine ». Chaque tâche ouverte reçoit ici un verdict pré-coché et sa raison ;
 * l'utilisateur peut inverser chaque choix — c'est lui qui les avait acceptées.
 *
 * Sans tâche ouverte, le composant ne rend rien et le parcours ne change pas.
 */
export function TaskReviewSection({
  plantId,
  diagnosisId,
  onChange,
  readOnly = false,
}: TaskReviewSectionProps) {
  const [review, setReview] = useState<DiagnosisReview | null>(null)
  const [verdicts, setVerdicts] = useState<Record<string, TaskVerdict>>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(
          `/api/v1/plants/${encodeURIComponent(plantId)}/diagnoses/${encodeURIComponent(diagnosisId)}/review`,
        )
        if (!res.ok) return

        const payload = (await res.json()) as { data: DiagnosisReview }
        if (cancelled) return

        setReview(payload.data)
        setVerdicts(
          Object.fromEntries(payload.data.tasks.map((task) => [task.taskId, task.verdict])),
        )
      } catch {
        // La revue est un confort : sans elle, on planifie comme avant. Un
        // écran de résultat ne doit pas échouer parce qu'elle n'a pas chargé.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [plantId, diagnosisId])

  useEffect(() => {
    onChange(
      Object.entries(verdicts)
        .filter(([, verdict]) => verdict === 'drop')
        .map(([taskId]) => taskId),
    )
  }, [verdicts, onChange])

  if (!review) return null
  const showTasks = !readOnly && review.tasks.length > 0

  if (!showTasks && review.superseded.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-poppins font-semibold text-sm text-forest">
        Tes actions en cours sur cette plante
      </h3>

      {showTasks &&
        review.tasks.map((task) => (
          <TaskRow
            key={task.taskId}
            task={task}
            verdict={verdicts[task.taskId] ?? task.verdict}
            onVerdict={(verdict) =>
              setVerdicts((prev) => ({ ...prev, [task.taskId]: verdict }))
            }
          />
        ))}

      {/* Ce que ce diagnostic a lui-même retiré, en relecture d'historique :
          les tâches ne sont jamais supprimées, seulement mises de côté. */}
      {review.superseded.map((task) => (
        <p
          key={task.taskId}
          className="flex items-center gap-2 rounded-xl bg-sand px-3 py-2 font-raleway text-xs text-forest/55"
        >
          <History size={13} aria-hidden />
          <span className="line-through">{task.shortLabel}</span>
          <span>· retirée le {shortDate(task.supersededAt)}</span>
        </p>
      ))}
    </section>
  )
}

function TaskRow({
  task,
  verdict,
  onVerdict,
}: {
  task: TaskReviewItem
  verdict: TaskVerdict
  onVerdict: (verdict: TaskVerdict) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white border border-forest/10 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-poppins text-sm font-semibold text-forest">{task.shortLabel}</p>
        <p className="font-raleway text-xs text-forest/60">{task.reason}</p>
      </div>

      <div
        className="flex shrink-0 overflow-hidden rounded-lg border border-forest/15"
        role="group"
        aria-label={`Que faire de : ${task.shortLabel}`}
      >
        {(['keep', 'drop'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={verdict === value}
            onClick={() => onVerdict(value)}
            className={`px-3 py-1.5 font-raleway text-xs font-semibold transition-colors ${
              verdict === value
                ? value === 'drop'
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-lime/40 text-forest'
                : 'bg-white text-forest/50 hover:bg-sand'
            }`}
          >
            {value === 'keep' ? 'Garder' : 'Retirer'}
          </button>
        ))}
      </div>
    </div>
  )
}
