import { Text, View } from 'react-native'
import { AlertTriangle, Clock, Hourglass } from 'lucide-react-native'

export interface SecretRecipeProps {
  story?: string | null
  ingredients: string[]
  /** Étapes séparées par des retours à la ligne. */
  recipe?: string | null
  cautions?: string | null
  prepDays?: number
  effortMinutes?: number | null
}

/**
 * Une étape par ligne, débarrassée d'une numérotation ou d'une puce saisie à
 * la main : c'est l'écran qui numérote, sinon on lirait « 1. 1. Cueille… ».
 */
export function recipeSteps(recipe: string | null | undefined): string[] {
  if (!recipe) return []
  return recipe
    .split('\n')
    .map((line) => line.trim().replace(/^(\d+[.)]|[-•*])\s*/, ''))
    .filter(Boolean)
}

function Heading({ children }: { children: string }) {
  return (
    <Text className="font-poppins text-caption uppercase text-muted-foreground">{children}</Text>
  )
}

/**
 * Le contenu d'un secret dévoilé : son histoire, ce qu'il faut, la recette en
 * étapes, et les précautions. Partagé par la feuille du planning et le
 * grimoire, pour qu'un secret se lise pareil aux deux endroits.
 */
export function SecretRecipe({
  story,
  ingredients,
  recipe,
  cautions,
  prepDays = 0,
  effortMinutes,
}: SecretRecipeProps) {
  const steps = recipeSteps(recipe)

  return (
    <View className="gap-4">
      {story ? (
        <Text className="font-raleway text-body italic leading-6 text-forest">{story}</Text>
      ) : null}

      {prepDays > 0 || effortMinutes ? (
        <View className="flex-row flex-wrap gap-2">
          {effortMinutes ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-card px-3 py-1.5">
              <Clock size={14} color="#1E5631" />
              <Text className="font-raleway-medium text-caption text-forest">
                {effortMinutes} min de préparation
              </Text>
            </View>
          ) : null}
          {prepDays > 0 ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-sun/50 px-3 py-1.5">
              <Hourglass size={14} color="#1E5631" />
              <Text className="font-raleway-medium text-caption text-forest">
                Prêt dans {prepDays} jour{prepDays > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {ingredients.length > 0 ? (
        <View className="gap-1.5">
          <Heading>Ce qu&apos;il te faut</Heading>
          {ingredients.map((ingredient, index) => (
            <View key={`${ingredient}-${index}`} className="flex-row gap-2">
              <Text className="font-raleway text-body text-forest">•</Text>
              <Text className="flex-1 font-raleway text-body text-forest">{ingredient}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {steps.length > 0 ? (
        <View className="gap-2">
          <Heading>La recette</Heading>
          {steps.map((step, index) => (
            <View key={index} className="flex-row gap-3">
              <View className="h-6 w-6 items-center justify-center rounded-full bg-forest">
                <Text className="font-poppins text-caption text-sand">{index + 1}</Text>
              </View>
              <Text className="flex-1 font-raleway text-body leading-6 text-forest">{step}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {cautions ? (
        <View className="flex-row gap-2 rounded-xl bg-sun/30 p-3">
          <AlertTriangle size={18} color="#1E5631" />
          <View className="flex-1 gap-0.5">
            <Text className="font-raleway-semibold text-secondary text-forest">Précautions</Text>
            <Text className="font-raleway text-secondary text-forest">{cautions}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}
