import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Expand, Monitor } from 'lucide-react-native'
import { isApiError } from '@growi/api-client'

import { GardenPlanView } from '@/components/garden/GardenPlanView'
import { Skeleton } from '@/components/ui/states'
import { useGardenPlan } from '@/lib/queries/gardens'

/**
 * Aperçu du plan en tête de la fiche jardin.
 *
 * Le plan se **consulte** ici, il ne se modifie pas : l'éditeur demande un
 * pointeur précis et un grand écran. Plutôt que de le taire, la carte le dit —
 * un utilisateur qui cherche comment dessiner doit apprendre où le faire, pas
 * conclure que l'app est incomplète.
 */
export function GardenPlanCard({ gardenId }: { gardenId: string }) {
  const router = useRouter()
  const plan = useGardenPlan(gardenId)

  if (plan.isPending) {
    return (
      <View className="overflow-hidden rounded-2xl bg-card" style={{ aspectRatio: 4 / 3 }}>
        <Skeleton className="h-full w-full" />
      </View>
    )
  }

  // Pas encore de plan : on invite à en faire un, on ne signale pas une panne.
  if (plan.isError) {
    return isApiError(plan.error) && plan.error.isNotFound ? <NoPlanCard /> : null
  }

  // L'aperçu suit les proportions du plan, mais borné : un jardin très allongé
  // se réduirait à un timbre-poste dans un cadre fixe, et un jardin très large
  // ferait une bande trop haute pour laisser voir la suite de la fiche.
  const ratio = Math.min(Math.max(plan.data.width / plan.data.height, 0.75), 1.6)

  return (
    <View className="overflow-hidden rounded-2xl bg-card">
      <Pressable
        onPress={() =>
          router.push({ pathname: '/(tabs)/jardins/[id]/plan', params: { id: gardenId } })
        }
        accessibilityRole="button"
        accessibilityLabel="Agrandir le plan du jardin"
        style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
      >
        <View style={{ aspectRatio: ratio }}>
          <GardenPlanView plan={plan.data} />
        </View>

        <View className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-forest/90">
          <Expand size={20} color="#F9F7E8" />
        </View>
      </Pressable>

      <EditNotice />
    </View>
  )
}

function NoPlanCard() {
  return (
    <View className="gap-2 rounded-2xl bg-card p-4">
      <Text className="font-poppins text-section text-forest">Pas encore de plan</Text>
      <Text className="font-raleway text-secondary text-muted-foreground">
        Dessine ton jardin depuis un ordinateur : tu pourras ensuite le consulter ici, avec tes
        zones et tes plantations.
      </Text>
      <EditNotice className="mt-1" />
    </View>
  )
}

/** La mention qui explique où se fait le dessin. */
function EditNotice({ className = '' }: { className?: string }) {
  return (
    <View className={`flex-row items-center gap-2 px-4 py-3 ${className}`}>
      <Monitor size={16} color="hsl(139 20% 40%)" />
      <Text className="flex-1 font-raleway text-caption text-muted-foreground">
        Le plan se modifie depuis un ordinateur, sur growi-garden.fr
      </Text>
    </View>
  )
}
