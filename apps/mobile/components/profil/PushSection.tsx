import { useCallback, useEffect, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { BellOff, BellRing, Settings } from 'lucide-react-native'

import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { getPushState, registerDeviceForPush, type PushState } from '@/lib/push'

export interface PushSectionProps {
  /** L'utilisateur veut-il des notifications ? (`alertConfig.channel`) */
  enabled: boolean
  onChange: (enabled: boolean) => void
}

/**
 * Réglage des notifications push.
 *
 * Deux autorisations se superposent, et l'écran doit les distinguer : celle du
 * téléphone, que seuls ses réglages accordent, et celle que l'utilisateur donne
 * à Growi. Un interrupteur qui ne préciserait pas laquelle manque laisserait
 * quelqu'un le basculer en boucle sans jamais rien recevoir.
 */
export function PushSection({ enabled, onChange }: PushSectionProps) {
  const toast = useToast()
  const [state, setState] = useState<PushState | null>(null)
  const [asking, setAsking] = useState(false)

  // Au retour des réglages du téléphone, la permission a pu changer : on la
  // relit à chaque fois que l'écran revient au premier plan.
  useFocusEffect(
    useCallback(() => {
      let active = true
      void getPushState().then((next) => {
        if (active) setState(next)
      })
      return () => {
        active = false
      }
    }, []),
  )

  // Le compte veut des notifications et le téléphone les autorise : on
  // s'assure que le serveur connaît bien cet appareil.
  useEffect(() => {
    if (state === 'granted' && enabled) void registerDeviceForPush()
  }, [state, enabled])

  const askPermission = async () => {
    setAsking(true)
    try {
      const { state: next, registered } = await registerDeviceForPush(true)
      setState(next)

      if (next === 'granted') {
        onChange(true)
        toast(
          registered
            ? 'Notifications activées 🔔'
            : 'Notifications autorisées — Growi finira l’enregistrement à la prochaine ouverture.',
        )
      }
    } finally {
      setAsking(false)
    }
  }

  // Tant que la permission n'est pas lue, on n'affiche rien plutôt qu'un état
  // qui se corrigerait sous les yeux de l'utilisateur.
  if (state === null) return null

  if (state === 'unsupported') {
    return (
      <View className="rounded-xl bg-card p-4 flex-row gap-3">
        <BellOff size={22} color="hsl(139 20% 40%)" />
        <Text className="font-raleway text-secondary text-muted-foreground flex-1">
          Les notifications demandent un vrai téléphone : le simulateur ne peut pas en recevoir.
        </Text>
      </View>
    )
  }

  if (state === 'undetermined') {
    return (
      <View className="gap-3">
        <View className="rounded-xl bg-card p-4 flex-row gap-3">
          <BellRing size={22} color="#1E5631" />
          <Text className="font-raleway text-secondary text-muted-foreground flex-1">
            Growi peut te rappeler chaque matin les gestes du jour, sans jamais t’écrire quand ton
            jardin n’a besoin de rien.
          </Text>
        </View>
        <Button
          label="Activer les notifications"
          variant="outline"
          loading={asking}
          onPress={() => void askPermission()}
          icon={<BellRing size={20} color="#1E5631" />}
        />
      </View>
    )
  }

  if (state === 'denied') {
    return (
      <View className="gap-3">
        <View className="rounded-xl bg-card p-4 flex-row gap-3">
          <BellOff size={22} color="hsl(139 20% 40%)" />
          <Text className="font-raleway text-secondary text-muted-foreground flex-1">
            Ton téléphone bloque les notifications de Growi. Tu peux les rouvrir dans ses réglages.
          </Text>
        </View>
        <Button
          label="Ouvrir les réglages"
          variant="outline"
          onPress={() => void Linking.openSettings()}
          icon={<Settings size={20} color="#1E5631" />}
        />
      </View>
    )
  }

  return (
    <View className="rounded-xl bg-card px-4">
      <Toggle
        label="Rappels du matin"
        hint="Les gestes du jour, en début de matinée. Rien si ton jardin est à jour."
        value={enabled}
        onChange={onChange}
      />
    </View>
  )
}
