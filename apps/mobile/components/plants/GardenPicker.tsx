import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Check, ChevronDown, Map, Plus } from 'lucide-react-native'
import type { GardenWithStats } from '@growi/shared'

/**
 * Sélecteur de jardin de « Mes plantes ».
 *
 * « Mon jardin » n'est plus un onglet : un jardin est un **classement**, pas
 * une destination. Ce sélecteur en tient lieu, et vaut par son défaut —
 * **tous les jardins** : quelqu'un qui n'en a qu'un ne doit pas avoir à
 * choisir, et l'écran garde son sens de vue d'ensemble.
 *
 * Une liste déroulante native (`Picker`) aurait imposé un module de plus et une
 * apparence différente sur les deux plateformes. Une feuille modale reste dans
 * le design system, et laisse la place aux deux entrées vers les jardins
 * eux-mêmes — plan, création — que la barre d'onglets ne porte plus.
 */

/** Valeur du sélecteur : un identifiant de jardin, ou tous. */
export type GardenFilter = string | 'all'

export interface GardenPickerProps {
  gardens: GardenWithStats[]
  value: GardenFilter
  onChange: (value: GardenFilter) => void
  /**
   * Nombre de plantes par jardin, calculé par l'écran à partir de la liste
   * qu'il a déjà. `GardenWithStats.plantCount` est facultatif, et un compte
   * absent afficherait « 0 plante » là où il y en a.
   */
  counts: Record<string, number>
  totalCount: number
}

export function GardenPicker({
  gardens,
  value,
  onChange,
  counts,
  totalCount,
}: GardenPickerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Un compte sans jardin n'a rien à filtrer : le sélecteur disparaît plutôt
  // que d'afficher un choix unique et inerte.
  if (gardens.length === 0) return null

  const selected = value === 'all' ? null : gardens.find((garden) => garden.id === value)
  const label = selected?.name ?? 'Tous les jardins'

  const choose = (next: GardenFilter) => {
    onChange(next)
    setOpen(false)
  }

  const go = (path: Href) => {
    setOpen(false)
    router.push(path)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Jardin affiché : ${label}. Changer de jardin`}
        // h-11 : zone tactile de 44 pt.
        className="h-11 flex-row items-center gap-2 self-start rounded-lg border border-input bg-card px-4"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
      >
        <Text className="font-raleway-medium text-secondary text-forest" numberOfLines={1}>
          {label}
        </Text>
        <ChevronDown size={18} color="#1E5631" />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        {/* Le fond ferme la feuille : sur Android, le bouton retour le fait
            déjà, sur iOS il n'y a que ça et le bouton « Fermer ». */}
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Fermer"
          className="flex-1 justify-end bg-forest/40"
        >
          <Pressable onPress={() => undefined} className="max-h-[70%] rounded-t-2xl bg-sand pb-8">
            <View className="flex-row items-center justify-between px-4 py-4">
              <Text className="font-poppins text-section text-forest">Afficher</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button">
                <Text className="font-raleway text-body text-muted-foreground">Fermer</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerClassName="px-4 pb-2 gap-2">
              <Option
                label="Tous les jardins"
                hint={`${totalCount} plante${totalCount > 1 ? 's' : ''}`}
                selected={value === 'all'}
                onPress={() => choose('all')}
              />

              {gardens.map((garden) => (
                <Option
                  key={garden.id}
                  label={garden.name}
                  hint={`${counts[garden.id] ?? 0} plante${(counts[garden.id] ?? 0) > 1 ? 's' : ''}`}
                  selected={value === garden.id}
                  onPress={() => choose(garden.id)}
                />
              ))}
            </ScrollView>

            {/* Les jardins eux-mêmes restent atteignables : ils n'ont plus
                d'onglet, mais le plan et la création vivent toujours. */}
            <View className="gap-2 border-t border-border px-4 pt-3">
              <Action
                icon={<Map size={20} color="#1E5631" />}
                label="Gérer mes jardins"
                onPress={() => go('/(tabs)/jardins')}
              />
              <Action
                icon={<Plus size={20} color="#1E5631" />}
                label="Créer un jardin"
                onPress={() => go('/(tabs)/jardins/nouveau')}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function Option({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string
  hint: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={[
        'min-h-[56px] flex-row items-center gap-3 rounded-xl px-4 py-3',
        selected ? 'bg-lime' : 'bg-card',
      ].join(' ')}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <View className="flex-1">
        <Text className="font-raleway-medium text-body text-forest" numberOfLines={1}>
          {label}
        </Text>
        <Text className="font-raleway text-caption text-muted-foreground">{hint}</Text>
      </View>
      {selected ? <Check size={20} color="#1E5631" /> : null}
    </Pressable>
  )
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="h-11 flex-row items-center gap-3 rounded-xl px-4"
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      {icon}
      <Text className="font-raleway-medium text-body text-forest">{label}</Text>
    </Pressable>
  )
}
