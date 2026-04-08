// growi-frontend/components/dashboard/calendrier/cards/ActionGroupAccordion.tsx
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'
import { GardenAction, ActionType } from '@/lib/mock-actions'
import { groupByType } from '@/lib/calendar-utils'
import { ActionRowCompact } from './ActionRowCompact'

const typeLabel: Record<ActionType, string> = {
  arrosage:     'arrosage',
  taille:       'taille',
  semis:        'semis',
  rempotage:    'rempotage',
  fertilisation:'fertilisation',
  traitement:   'traitement',
  recolte:      'récolte',
  autre:        'autre',
}

interface ActionGroupAccordionProps {
  actions: GardenAction[]
  weekLabel: string
  groupId: string
  onDone: (id: string) => void
}

export function ActionGroupAccordion({
  actions,
  weekLabel,
  groupId,
  onDone,
}: ActionGroupAccordionProps) {
  const grouped = groupByType(actions)

  // Build summary: "3 arrosages · 1 taille"
  const summary = Object.entries(grouped)
    .map(([type, items]) => {
      const count = items!.length
      const label = typeLabel[type as ActionType]
      return `${count} ${label}${count > 1 ? 's' : ''}`
    })
    .join(' · ')

  return (
    <Accordion type="single">
      <AccordionItem value={groupId}>
        <AccordionTrigger>
          🌿 {summary} — {weekLabel}
        </AccordionTrigger>
        <AccordionContent>
          <div className="pt-1">
            {actions.map(a => (
              <ActionRowCompact key={a.id} action={a} onDone={onDone} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
