import { type Plant } from '@/lib/plant-types'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

interface TipItem {
  key: string
  label: string
  icon: string
  content: string | undefined
}

interface TipItemDefined {
  key: string
  label: string
  icon: string
  content: string
}

interface PlantCareTipsSectionProps {
  plant: Plant
}

export function PlantCareTipsSection({ plant }: PlantCareTipsSectionProps) {
  const tips: TipItemDefined[] = ([
    { key: 'watering', label: 'Arrosage', icon: '💧', content: plant.careTips.watering },
    { key: 'light',    label: 'Lumière',  icon: '☀️', content: plant.careTips.light },
    { key: 'soil',     label: 'Sol',      icon: '🌱', content: plant.careTips.soil },
    { key: 'pruning',  label: 'Taille',   icon: '✂️', content: plant.careTips.pruning },
    { key: 'diseases', label: 'Maladies', icon: '🔍', content: plant.careTips.diseases },
    { key: 'winter',   label: 'Hiver',    icon: '❄️', content: plant.careTips.winter },
  ] as TipItem[]).filter((t): t is TipItemDefined => Boolean(t.content))

  return (
    <div className="rounded-2xl bg-white shadow-card p-6">
      <h2 className="font-poppins font-semibold text-lg text-forest mb-4">
        Conseils d&apos;entretien
      </h2>
      <Accordion type="multiple" defaultValue={['watering']}>
        {tips.map(tip => (
          <AccordionItem key={tip.key} value={tip.key}>
            <AccordionTrigger>
              <span className="flex items-center gap-2">
                <span aria-hidden>{tip.icon}</span>
                {tip.label}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="font-raleway text-forest/80 leading-relaxed">
                {tip.content}
              </p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {plant.funFact && (
        <div className="mt-6 rounded-xl bg-lime/10 border border-lime/30 p-4">
          <p className="font-raleway text-sm text-forest leading-relaxed">
            <strong>Le savais-tu ?</strong> {plant.funFact}
          </p>
        </div>
      )}
    </div>
  )
}
