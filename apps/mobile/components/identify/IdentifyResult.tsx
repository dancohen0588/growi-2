import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import { AlertTriangle, Lightbulb } from 'lucide-react-native'
import type { IdentifyConfidence, IdentifyDifficulty, IdentifySuccess } from '@growi/shared'

/** Ce que vaut l'identification, dit franchement. */
const CONFIDENCE: Record<IdentifyConfidence, { label: string; tone: string }> = {
  high: { label: '✓ Identification certaine', tone: 'bg-lime' },
  medium: { label: '~ Identification probable', tone: 'bg-sun' },
  low: { label: '? Identification incertaine', tone: 'bg-destructive/20' },
}

const DIFFICULTY: Record<IdentifyDifficulty, string> = {
  easy: 'Facile 🟢',
  medium: 'Moyen 🟡',
  demanding: 'Exigeant 🔴',
}

function CareItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View className="flex-1 gap-1 rounded-xl bg-sand p-3">
      <Text className="font-poppins text-caption text-muted-foreground">
        {icon} {label}
      </Text>
      <Text className="font-raleway text-secondary text-forest">{value}</Text>
    </View>
  )
}

/**
 * La fiche d'une plante reconnue, reprise de la page Identifier du web :
 * photo, nom, confiance, description, guide d'entretien, anecdote, points
 * d'attention et mots-clés.
 */
export function IdentifyResult({
  result,
  photoUri,
}: {
  result: IdentifySuccess & { encyclopediaSlug: string | null }
  photoUri: string
}) {
  const confidence = CONFIDENCE[result.confidence]

  return (
    <View className="gap-4">
      <View className="h-52 w-full overflow-hidden rounded-2xl bg-sand-dark">
        <Image
          source={photoUri}
          contentFit="cover"
          transition={150}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      </View>

      <View className="gap-4 rounded-2xl bg-card p-4">
        <View className="gap-1">
          <Text className="font-poppins-bold text-screen text-forest">
            {result.emoji} {result.commonName}
          </Text>
          <Text className="font-raleway text-secondary text-muted-foreground italic">
            {result.scientificName}
            {result.family ? ` · ${result.family}` : ''}
          </Text>

          <View className={`mt-1 self-start rounded-full px-3 py-1 ${confidence.tone}`}>
            <Text className="font-raleway-semibold text-caption text-forest">
              {confidence.label}
            </Text>
          </View>
        </View>

        <Text className="font-raleway text-body text-forest">{result.shortDescription}</Text>

        <View className="gap-2">
          <Text className="font-poppins text-section text-forest">Guide d'entretien</Text>

          <View className="flex-row gap-2">
            <CareItem icon="💧" label="Arrosage" value={result.careGuide.watering} />
            <CareItem icon="☀️" label="Lumière" value={result.careGuide.light} />
          </View>
          <View className="flex-row gap-2">
            <CareItem icon="🪴" label="Substrat" value={result.careGuide.soil} />
            <CareItem icon="🌡️" label="Températures" value={result.careGuide.temperature} />
          </View>

          <View className="self-start rounded-full bg-sand-dark px-3 py-1">
            <Text className="font-raleway-semibold text-caption text-forest">
              Difficulté · {DIFFICULTY[result.careGuide.difficulty]}
            </Text>
          </View>
        </View>

        <View className="flex-row items-start gap-2 rounded-xl bg-sand p-3">
          <Lightbulb size={16} color="#1E5631" />
          <Text className="flex-1 font-raleway text-secondary text-forest">
            <Text className="font-raleway-semibold">Le savais-tu ? </Text>
            {result.funFact}
          </Text>
        </View>

        {result.warnings.length > 0 ? (
          <View className="gap-2 rounded-xl border border-destructive bg-card p-3">
            <View className="flex-row items-center gap-2">
              <AlertTriangle size={16} color="hsl(0 84% 60%)" />
              <Text className="font-poppins text-secondary text-destructive">
                Points d'attention
              </Text>
            </View>
            {result.warnings.map((warning, index) => (
              <Text key={index} className="font-raleway text-secondary text-forest">
                • {warning}
              </Text>
            ))}
          </View>
        ) : null}

        {result.tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {result.tags.map((tag) => (
              <View key={tag} className="rounded-full bg-lime/30 px-2.5 py-1">
                <Text className="font-raleway-medium text-caption text-forest">#{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}
