import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronRight, UserCircle2 } from 'lucide-react-native'

import { AlertCard } from '@/components/planning/AlertCard'
import { PlanningSections } from '@/components/planning/PlanningSections'
import { WeatherBanner, WeatherUnavailable } from '@/components/planning/WeatherBanner'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatDayLabel, greeting } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useMarkActionDone, usePlanningTasks, type PlanningTask } from '@/lib/queries/planning'

/**
 * Accueil : la météo du jour, ce qu'il y a à surveiller, et les gestes du
 * jour même. Ce qui vient ensuite est du ressort du calendrier — l'accueil
 * répond à « et maintenant ? », pas à « et cette semaine ? ».
 */
export default function AccueilScreen() {
  const router = useRouter()
  const toast = useToast()

  const planning = usePlanningTasks()
  const markDone = useMarkActionDone()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await planning.query.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [planning.query])

  const completeTask = ({ action, gardenId }: PlanningTask) => {
    markDone.mutate(
      { actionId: action.id, gardenId, actionType: action.type, plantId: action.plantId },
      {
        onSuccess: () => toast('Bien noté, ton jardin te remercie 🌱'),
        onError: (error) => toast(errorMessage(error), 'error'),
      },
    )
  }

  const openPlant = ({ action }: PlanningTask) =>
    action.plantId
      ? () => router.push(`/(tabs)/accueil/plantes/${action.plantId}`)
      : undefined

  const upcoming = planning.groups.tomorrow.length + planning.groups.later.length

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerClassName="pb-8 pt-2 gap-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
      >
        <View className="flex-row items-start justify-between gap-3 px-4">
          <View className="flex-1 gap-0.5">
            <Text className="font-poppins-bold text-screen text-forest">{greeting()} 👋</Text>
            <Text className="font-raleway text-secondary text-muted-foreground">
              {formatDayLabel()}
              {planning.groups.today.length > 0
                ? ` · ${planning.groups.today.length} geste${
                    planning.groups.today.length > 1 ? 's' : ''
                  } aujourd'hui`
                : ''}
            </Text>
          </View>

          {/* Le profil quitte la barre d'onglets, prise par les écrans du
              jardin ; il reste à un tap d'ici. */}
          <Pressable
            onPress={() => router.push('/(tabs)/accueil/profil')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Mon profil"
          >
            <UserCircle2 size={28} color="#1E5631" />
          </Pressable>
        </View>

        {planning.query.isPending ? (
          <View className="px-4">
            <ListSkeleton count={4} />
          </View>
        ) : planning.query.isError ? (
          <ErrorState
            message={errorMessage(planning.query.error)}
            onRetry={() => void planning.query.refetch()}
          />
        ) : (
          <>
            <View className="px-4">
              {planning.weather ? (
                <WeatherBanner weather={planning.weather} />
              ) : (
                <WeatherUnavailable />
              )}
            </View>

            {planning.alerts.length > 0 ? (
              <View className="gap-2 px-4">
                <Text className="font-poppins text-section text-forest">À surveiller</Text>
                {planning.alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            ) : null}

            {!planning.hasGarden ? (
              <EmptyState
                emoji="🌱"
                title="Ton premier jardin t'attend"
                message="Crée un jardin et ajoute tes plantes : les gestes du jour apparaîtront ici."
                cta={{ label: 'Créer un jardin', onPress: () => router.push('/(tabs)/jardins') }}
              />
            ) : planning.groups.today.length === 0 ? (
              <EmptyState
                emoji="🌿"
                title="Tout est à jour"
                message="Rien à faire aujourd'hui. Profites-en pour observer tes plantes — elles te le rendront."
              />
            ) : (
              <PlanningSections
                horizons={['today']}
                groups={planning.groups}
                today={planning.date}
                showGardenNames={planning.showGardenNames}
                onDone={completeTask}
                onOpenPlant={openPlant}
              />
            )}

            {upcoming > 0 ? (
              <Pressable
                onPress={() => router.push('/(tabs)/calendrier')}
                accessibilityRole="button"
                className="mx-4 flex-row items-center justify-between rounded-xl bg-card p-4"
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
              >
                <Text className="font-raleway-medium text-body text-forest">
                  {upcoming} geste{upcoming > 1 ? 's' : ''} à venir
                </Text>
                <View className="flex-row items-center gap-1">
                  <Text className="font-raleway text-secondary text-muted-foreground">
                    Voir le calendrier
                  </Text>
                  <ChevronRight size={18} color="hsl(139 20% 40%)" />
                </View>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
