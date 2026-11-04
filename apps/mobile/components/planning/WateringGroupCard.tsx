import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Check, Droplets, X } from 'lucide-react-native'
import type { ActionGroup, GardenAction } from '@growi/shared'

import { useIsMutating } from '@tanstack/react-query'

import { formatActionWhen } from '@/lib/dates'
import { MARK_ACTIONS_DONE_BULK_KEY } from '@/lib/queries/planning'

/** Au-delà, les vignettes ne se distinguent plus les unes des autres. */
const MAX_AVATARS = 5

export interface WateringGroupCardProps {
  group: ActionGroup
  /** Largeur imposée par le carrousel du jour ; pleine largeur ailleurs. */
  width?: number
  /**
   * Coche les actions retenues en un seul appel.
   *
   * Absent, la carte n'a pas de bouton : c'est le cas de « Plus tard », où
   * arroser d'avance une plante prévue dans deux semaines n'a pas de sens —
   * et notait un vrai geste qui repoussait d'autant le suivant.
   */
  onDoneMany?: (actions: GardenAction[]) => void
  onOpenDetail: (action: GardenAction) => void
}

function Avatar({ action }: { action: GardenAction }) {
  return (
    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-sand-dark">
      {action.plantPhotoUrl ? (
        <Image
          source={action.plantPhotoUrl}
          contentFit="cover"
          transition={150}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text className="text-lg">{action.plantEmoji || '🌿'}</Text>
      )}
    </View>
  )
}

/**
 * Un geste, une carte : arroser cinq plantes n'est pas cinq décisions.
 *
 * Cinq cartes à valider une à une chaque matin, c'est ce qui donnait envie de
 * tout ignorer. « Tout arrosé » coche l'ensemble en un appel ; « Choisir »
 * ouvre la liste, toutes cochées, pour décocher l'exception plutôt que de
 * cocher la règle.
 */
export function WateringGroupCard({
  group,
  width,
  onDoneMany,
  onOpenDetail,
}: WateringGroupCardProps) {
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.actions.map((a) => a.id)),
  )

  const late = group.actions.filter((a) => formatActionWhen(a).late).length
  const shown = group.actions.slice(0, MAX_AVATARS)
  const names = group.actions
    .map((a) => a.plantName)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')

  const chosen = group.actions.filter((a) => selected.has(a.id))

  // Une tournée en cours d'écriture : un second appui, sur cette carte ou une
  // autre, noterait les mêmes plantes deux fois.
  const busy = useIsMutating({ mutationKey: MARK_ACTIONS_DONE_BULK_KEY }) > 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <View className="gap-3 rounded-2xl bg-card p-4" style={width ? { width } : undefined}>
      <View className="flex-row items-center gap-2">
        <Droplets size={18} color="#1E5631" />
        <Text className="flex-1 font-poppins text-body text-forest" numberOfLines={1}>
          Arrosage · {group.actions.length} plantes
        </Text>
      </View>

      <View className="flex-row">
        {shown.map((action, index) => (
          <Pressable
            key={action.id}
            onPress={() => onOpenDetail(action)}
            accessibilityRole="button"
            accessibilityLabel={`Détails : ${action.plantName ?? 'plante'}`}
            hitSlop={4}
            style={index > 0 ? { marginLeft: -8 } : undefined}
          >
            <Avatar action={action} />
          </Pressable>
        ))}
        {group.actions.length > MAX_AVATARS ? (
          <View
            className="h-10 w-10 items-center justify-center rounded-full border-2 border-card bg-sand"
            style={{ marginLeft: -8 }}
          >
            <Text className="font-raleway-semibold text-caption text-forest">
              +{group.actions.length - MAX_AVATARS}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
        {names}
        {late > 0 ? <Text className="text-destructive"> · {late} en retard</Text> : null}
      </Text>

      {onDoneMany ? (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onDoneMany(group.actions)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel={`Tout arrosé : ${group.actions.length} plantes`}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-lime"
            style={({ pressed }) => ({
              opacity: busy ? 0.5 : 1,
              backgroundColor: pressed ? '#a2cf6b' : undefined,
            })}
          >
            <Check size={19} color="#1E5631" />
            <Text className="font-raleway-semibold text-body text-forest">Tout arrosé</Text>
          </Pressable>

          <Pressable
            onPress={() => setPicking(true)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityLabel="Choisir les plantes arrosées"
            className="h-12 items-center justify-center rounded-xl bg-sand-dark px-4"
            style={({ pressed }) => ({ opacity: busy ? 0.5 : pressed ? 0.8 : 1 })}
          >
            <Text className="font-raleway-semibold text-secondary text-forest">Choisir</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable
          className="flex-1 bg-forest/40"
          onPress={() => setPicking(false)}
          accessibilityLabel="Fermer"
        />

        <View className="max-h-[75%] rounded-t-3xl bg-sand px-4 pb-10 pt-3">
          <View className="mb-3 h-1 w-10 self-center rounded-full bg-sand-dark" />

          <View className="mb-3 flex-row items-center gap-2">
            <Text className="flex-1 font-poppins text-section text-forest">
              Qu&apos;est-ce que tu as arrosé ?
            </Text>
            <Pressable
              onPress={() => setPicking(false)}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              hitSlop={12}
              className="h-11 w-11 items-center justify-center"
            >
              <X size={22} color="#1E5631" />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-1 pb-3" showsVerticalScrollIndicator={false}>
            {group.actions.map((action) => {
              const checked = selected.has(action.id)
              return (
                <Pressable
                  key={action.id}
                  onPress={() => toggle(action.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={action.plantName ?? 'Plante'}
                  className="h-12 flex-row items-center gap-3 rounded-xl px-2"
                  style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
                >
                  <View
                    className={[
                      'h-6 w-6 items-center justify-center rounded-md border-2',
                      checked ? 'border-lime bg-lime' : 'border-border',
                    ].join(' ')}
                  >
                    {checked ? <Check size={15} color="#1E5631" /> : null}
                  </View>
                  <Text className="text-lg">{action.plantEmoji || '🌿'}</Text>
                  <Text className="flex-1 font-raleway text-body text-forest" numberOfLines={1}>
                    {action.plantName ?? 'Plante'}
                  </Text>
                  <Text
                    className={[
                      'font-raleway text-caption',
                      formatActionWhen(action).late ? 'text-destructive' : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {formatActionWhen(action).label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <Pressable
            onPress={() => {
              setPicking(false)
              onDoneMany?.(chosen)
            }}
            disabled={chosen.length === 0}
            accessibilityRole="button"
            accessibilityLabel={`Valider ${chosen.length} arrosages`}
            className="h-14 flex-row items-center justify-center gap-2 rounded-xl bg-lime"
            style={({ pressed }) => ({
              opacity: chosen.length === 0 ? 0.5 : 1,
              backgroundColor: pressed ? '#a2cf6b' : undefined,
            })}
          >
            <Check size={20} color="#1E5631" />
            <Text className="font-raleway-semibold text-body text-forest">
              Valider ({chosen.length})
            </Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  )
}
