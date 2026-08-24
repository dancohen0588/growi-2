import { Text, View } from 'react-native'
import { Image } from 'expo-image'
import { CalendarClock, Sparkles } from 'lucide-react-native'
import {
  DIAGNOSIS_CONFIDENCE_LABELS,
  DIAGNOSIS_LIKELIHOOD_LABELS,
  DIAGNOSIS_PRIORITY_LABELS,
  HEALTH_STATUS_LABELS,
  type DiagnosisPriority,
  type DiagnosisSuccess,
  type HealthStatus,
} from '@growi/shared'

/**
 * Un diagnostic abouti, dans le même ordre que sur le web : état estimé,
 * observations, causes, recommandations, suivi — du constat vers l'action.
 */

/** Même code couleur que le badge de santé de la fiche plante. */
const STATUS_TONE: Record<HealthStatus, { tone: string; text: string }> = {
  HEALTHY: { tone: 'bg-lime', text: 'text-forest' },
  WARNING: { tone: 'bg-sun', text: 'text-forest' },
  CRITICAL: { tone: 'bg-destructive', text: 'text-sand' },
}

const PRIORITY_TONE: Record<DiagnosisPriority, string> = {
  urgent: 'bg-destructive/20',
  soon: 'bg-sun',
  watch: 'bg-lime',
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="font-poppins text-section text-forest">{children}</Text>
}

export interface DiagnosisResultProps {
  result: DiagnosisSuccess
  /** URI locale de la photo prise, ou URL de celle déjà stockée. */
  photoUri?: string | null
}

export function DiagnosisResult({ result, photoUri }: DiagnosisResultProps) {
  const status = STATUS_TONE[result.status]

  return (
    <View className="gap-5">
      {photoUri ? (
        <View className="h-52 w-full overflow-hidden rounded-2xl bg-sand-dark">
          <Image
            source={photoUri}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        </View>
      ) : null}

      <View className="gap-2 rounded-2xl bg-card p-4">
        <View className={`self-start rounded-full px-3 py-1 ${status.tone}`}>
          <Text className={`font-raleway-semibold text-caption ${status.text}`}>
            {HEALTH_STATUS_LABELS[result.status]}
          </Text>
        </View>
        <Text className="font-raleway text-body text-forest">{result.summary}</Text>
        <Text className="font-raleway text-caption text-muted-foreground">
          {DIAGNOSIS_CONFIDENCE_LABELS[result.confidence]}
        </Text>
      </View>

      {result.observations.length > 0 ? (
        <View className="gap-2">
          <SectionTitle>Ce que l&apos;on observe</SectionTitle>
          <View className="gap-1.5 rounded-xl bg-card p-4">
            {result.observations.map((observation, i) => (
              <View key={i} className="flex-row gap-2">
                <Text className="font-raleway text-secondary text-muted-foreground">•</Text>
                <Text className="flex-1 font-raleway text-secondary text-forest">
                  {observation}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {result.probableCauses.length > 0 ? (
        <View className="gap-2">
          <SectionTitle>Causes probables</SectionTitle>
          {result.probableCauses.map((cause, i) => (
            <View key={i} className="gap-1 rounded-xl bg-card p-4">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-raleway-semibold text-secondary text-forest">
                  {cause.label}
                </Text>
                <View className="rounded-full bg-sand px-2.5 py-0.5">
                  <Text className="font-raleway text-caption text-muted-foreground">
                    {DIAGNOSIS_LIKELIHOOD_LABELS[cause.likelihood]}
                  </Text>
                </View>
              </View>
              <Text className="font-raleway text-secondary text-muted-foreground">
                {cause.explanation}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {result.recommendations.length > 0 ? (
        <View className="gap-2">
          <SectionTitle>Que faire</SectionTitle>
          {result.recommendations.map((reco, i) => (
            <View key={i} className="flex-row items-start gap-3 rounded-xl bg-card p-4">
              <View className={`rounded-full px-2.5 py-0.5 ${PRIORITY_TONE[reco.priority]}`}>
                <Text className="font-raleway-semibold text-caption text-forest">
                  {DIAGNOSIS_PRIORITY_LABELS[reco.priority]}
                </Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-raleway text-secondary text-forest">{reco.action}</Text>
                <Text className="font-raleway text-caption text-muted-foreground">
                  {reco.timeframe}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {result.followUp ? (
        <View className="flex-row items-start gap-2 rounded-xl bg-lime/30 p-4">
          <CalendarClock size={18} color="#1E5631" />
          <Text className="flex-1 font-raleway text-secondary text-forest">
            {result.followUp}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-start gap-2">
        <Sparkles size={14} color="hsl(139 20% 40%)" />
        <Text className="flex-1 font-raleway text-caption text-muted-foreground">
          Diagnostic généré par IA — en cas de doute, demande l&apos;avis d&apos;un
          professionnel.
        </Text>
      </View>
    </View>
  )
}
