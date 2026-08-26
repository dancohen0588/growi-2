import { Stethoscope } from 'lucide-react'
import type { GardenAction } from '@/lib/mock-actions'

/**
 * Marque les tâches nées d'un diagnostic.
 *
 * Le planning mêle deux origines : ce que le moteur de règles calcule à partir
 * des besoins de la plante, et ce que l'utilisateur a lui-même accepté depuis
 * un diagnostic. Sans ce repère, une action qu'on n'a pas demandée et une
 * action qu'on a validée se ressemblent — et la confiance dans le planning
 * tient à ce qu'on sache d'où vient ce qu'il propose.
 */
export function DiagnosisBadge({ action }: { action: GardenAction }) {
  if (action.source !== 'task') return null

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime/25 px-2 py-0.5 font-raleway text-[11px] font-medium text-forest"
      title="Action issue d'un diagnostic que tu as planifié"
    >
      <Stethoscope size={11} aria-hidden />
      Diagnostic
    </span>
  )
}
