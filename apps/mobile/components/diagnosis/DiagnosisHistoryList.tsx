import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { CalendarPlus, ChevronDown } from 'lucide-react-native'
import {
  HEALTH_STATUS_LABELS,
  type DiagnosisListItem,
  type HealthStatus,
} from '@growi/shared'

import { DiagnosisResult } from '@/components/diagnosis/DiagnosisResult'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useDiagnosis, usePlanDiagnosisActions } from '@/lib/queries/diagnosis'

/**
 * Historique des diagnostics d'une plante, sur sa fiche.
 *
 * Rien ne s'affiche tant qu'il n'y a pas eu de diagnostic : une rubrique vide
 * sur chaque fiche donnerait l'impression d'un manque plutôt que d'une
 * possibilité — le CTA, lui, est toujours là.
 */

const STATUS_TONE: Record<HealthStatus, string> = {
  HEALTHY: 'bg-lime',
  WARNING: 'bg-sun',
  CRITICAL: 'bg-destructive',
}

/** Le détail n'est lu qu'à l'ouverture : la liste porte déjà l'essentiel. */
function DiagnosisDetail({
  plantId,
  diagnosisId,
  tasksPlannedAt,
}: {
  plantId: string
  diagnosisId: string
  tasksPlannedAt: string | null | undefined
}) {
  const detail = useDiagnosis(plantId, diagnosisId)
  const planActions = usePlanDiagnosisActions(plantId)
  const toast = useToast()
  const [plannedAt, setPlannedAt] = useState<string | null>(null)

  if (detail.isPending) {
    return (
      <View className="py-6">
        <ActivityIndicator color="#1E5631" />
      </View>
    )
  }

  if (detail.isError) {
    return (
      <Text className="py-4 font-raleway text-secondary text-muted-foreground">
        Ce diagnostic n&apos;a pas pu être relu.
      </Text>
    )
  }

  const planned = plannedAt ?? tasksPlannedAt
  const recommendations = detail.data.result.recommendations

  return (
    <View className="gap-4 pt-3">
      <DiagnosisResult result={detail.data.result} photoUri={detail.data.photoUrl} />

      {/* Un diagnostic relu se planifie aussi bien qu'un diagnostic frais :
          on repense souvent à une recommandation après coup. */}
      {recommendations.length > 0 && !planned ? (
        <Button
          label="Planifier ces actions"
          loading={planActions.isPending}
          onPress={() =>
            planActions.mutate(diagnosisId, {
              onSuccess: (result) => {
                setPlannedAt(result.tasksPlannedAt)
                toast('Actions planifiées — retrouve-les dans ton calendrier 📅')
              },
              onError: (error) => toast(errorMessage(error), 'error'),
            })
          }
          icon={<CalendarPlus size={18} color="#1E5631" />}
        />
      ) : null}
    </View>
  )
}

export function DiagnosisHistoryList({
  plantId,
  items,
}: {
  plantId: string
  items: DiagnosisListItem[]
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <View className="gap-2">
      <Text className="font-poppins text-section text-forest">Diagnostics</Text>

      {items.map((item) => {
        const open = openId === item.id

        return (
          <View key={item.id} className="rounded-xl bg-card px-4 py-3">
            <Pressable
              onPress={() => setOpenId(open ? null : item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${HEALTH_STATUS_LABELS[item.status]} — ${item.summary}`}
              accessibilityState={{ expanded: open }}
              hitSlop={8}
              className="flex-row items-center gap-3"
              style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
            >
              <View className={`h-2.5 w-2.5 rounded-full ${STATUS_TONE[item.status]}`} />

              <View className="flex-1 gap-0.5">
                <Text className="font-raleway-medium text-secondary text-forest">
                  {HEALTH_STATUS_LABELS[item.status]}
                  {item.statusApplied ? ' · appliqué' : ''}
                  {item.tasksPlannedAt ? ' · planifié' : ''}
                </Text>
                <Text
                  className="font-raleway text-caption text-muted-foreground"
                  numberOfLines={open ? undefined : 1}
                >
                  {item.summary}
                </Text>
              </View>

              <Text className="font-raleway text-caption text-muted-foreground">
                {formatLogDate(item.createdAt)}
              </Text>
              <ChevronDown
                size={18}
                color="hsl(139 20% 40%)"
                style={open ? { transform: [{ rotate: '180deg' }] } : undefined}
              />
            </Pressable>

            {open ? (
              <DiagnosisDetail
                plantId={plantId}
                diagnosisId={item.id}
                tasksPlannedAt={item.tasksPlannedAt}
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
