import { TriangleAlert } from 'lucide-react'

import { recipeSteps } from '@/lib/secrets/display'

interface SecretRecipeProps {
  story?: string | null
  ingredients: string[]
  recipe?: string | null
  cautions?: string | null
  /** Niveau des intertitres : la popin et le grimoire n'ont pas la même hiérarchie. */
  headingLevel?: 'h3' | 'h4'
}

function SectionTitle({ as: Tag, children }: { as: 'h3' | 'h4'; children: React.ReactNode }) {
  return (
    <Tag className="font-poppins text-xs font-semibold uppercase tracking-wide text-forest/55">{children}</Tag>
  )
}

/**
 * Le cœur d'un secret dévoilé : l'histoire, ce qu'il faut, la recette en
 * étapes, les précautions. Partagé par la popin du calendrier et le grimoire,
 * pour qu'une recette se lise pareil aux deux endroits.
 *
 * Une section sans contenu n'est pas rendue : un intertitre qui ne tient pas
 * sa promesse est pire qu'une popin courte.
 */
export function SecretRecipe({ story, ingredients, recipe, cautions, headingLevel = 'h3' }: SecretRecipeProps) {
  const steps = recipeSteps(recipe)

  return (
    <div className="flex flex-col gap-4">
      {story && (
        <section className="flex flex-col gap-1">
          <SectionTitle as={headingLevel}>L&apos;histoire</SectionTitle>
          <p className="font-raleway text-sm italic leading-relaxed text-forest/85">{story}</p>
        </section>
      )}

      {ingredients.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <SectionTitle as={headingLevel}>Ce qu&apos;il te faut</SectionTitle>
          <ul className="flex flex-wrap gap-1.5">
            {ingredients.map((ingredient) => (
              <li
                key={ingredient}
                className="rounded-full border border-dashed border-forest/30 bg-white/70 px-2.5 py-0.5 font-raleway text-sm text-forest"
              >
                {ingredient}
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <SectionTitle as={headingLevel}>La recette</SectionTitle>
          <ol className="flex flex-col gap-2">
            {steps.map((step, index) => (
              <li key={`${index}-${step}`} className="flex gap-3 font-raleway text-sm leading-relaxed text-forest/85">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest font-poppins text-xs font-semibold text-sand"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {cautions && (
        <section className="flex gap-2.5 rounded-xl bg-sun/20 px-3.5 py-3">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-forest" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <SectionTitle as={headingLevel}>Précautions</SectionTitle>
            <p className="font-raleway text-sm leading-relaxed text-forest/85">{cautions}</p>
          </div>
        </section>
      )}
    </div>
  )
}
