import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Users } from 'lucide-react-native'
import type { Quartier } from '@growi/shared'

import { SapProgressBar } from '@/components/sap/SapProgressBar'
import { Button } from '@/components/ui/Button'

import { QUARTIER_ACTION_ROUTES, daysLeftLabel } from './actions'

const MUTED_ON_DARK = '#E6F0DA'

type Challenge = NonNullable<Quartier['challenge']>

/** Des initiales qui se chevauchent : on voit qu'on n'est pas seul, pas qui a fait quoi. */
function Initials({ initials }: { initials: string[] }) {
  if (initials.length === 0) return null
  return (
    <View className="flex-row" accessible={false}>
      {initials.map((initial, index) => (
        <View
          key={index}
          className="h-7 w-7 items-center justify-center rounded-full border-2 border-forest bg-lime"
          style={{ marginLeft: index === 0 ? 0 : -8 }}
        >
          <Text className="font-poppins-bold text-caption text-forest">{initial}</Text>
        </View>
      ))}
    </View>
  )
}

function participationLine(challenge: Challenge): string {
  const who =
    challenge.participants === 0
      ? 'Personne n’a encore commencé'
      : `${challenge.participants} jardinier${challenge.participants > 1 ? 's' : ''} participe${challenge.participants > 1 ? 'nt' : ''}`
  return challenge.mine > 0 ? `${who} · ta part : ${challenge.mine}` : who
}

/**
 * Le défi de la semaine, en grand — le haut de « Ton quartier ».
 */
export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const router = useRouter()
  const progress = Math.min(1, challenge.progress / challenge.target)
  const route = QUARTIER_ACTION_ROUTES[challenge.action.target]

  const act = () => (route.mode === 'push' ? router.push(route.href) : router.navigate(route.href))

  return (
    <View className="gap-4 rounded-3xl bg-forest p-5">
      <View className="flex-row items-center gap-2 self-start rounded-full bg-forest-light/70 px-3 py-1.5">
        <View className="h-2 w-2 rounded-full bg-sun" />
        <Text className="font-raleway-semibold text-caption" style={{ color: MUTED_ON_DARK }}>
          Défi de la semaine · {daysLeftLabel(challenge.daysLeft)}
        </Text>
      </View>

      <Text className="font-poppins-bold text-sand" style={{ fontSize: 24, lineHeight: 30 }} accessibilityRole="header">
        {challenge.title}
      </Text>

      <View className="gap-2">
        <View className="flex-row items-baseline gap-2">
          <Text className="font-poppins-bold text-lime" style={{ fontSize: 32, lineHeight: 38 }}>
            {challenge.progress}
          </Text>
          <Text className="flex-1 font-raleway-medium text-body" style={{ color: MUTED_ON_DARK }}>
            / {challenge.target} {challenge.unitLabel}
          </Text>
        </View>
        <SapProgressBar progress={progress} onDark />
      </View>

      <View className="flex-row items-center gap-3">
        <Initials initials={challenge.participantInitials} />
        <Text className="flex-1 font-raleway text-secondary" style={{ color: MUTED_ON_DARK }}>
          {participationLine(challenge)}
        </Text>
      </View>

      <View className="gap-1 rounded-xl bg-forest-light/60 p-3.5">
        <Text className="font-raleway-bold text-caption uppercase tracking-widest text-lime">
          {challenge.reached ? 'Objectif atteint !' : 'Si on y arrive ensemble'}
        </Text>
        <Text className="font-raleway text-secondary text-sand">
          {challenge.reached
            ? `Lundi matin, chaque participant reçoit ${challenge.successSap + challenge.participationSap} de sève, et tout le quartier découvre un Secret inédit. Tu peux encore ajouter ta part.`
            : `Tout le quartier découvre un Secret inédit, et chaque participant gagne ${challenge.successSap} de sève. Même si on n’y arrive pas, ta participation compte : +${challenge.participationSap}.`}
        </Text>
      </View>

      <Button label={challenge.action.label} variant="primary" size="lg" font="poppins-bold" onPress={act} />
    </View>
  )
}

/** Le défi en une ligne, en tête du fil de la Communauté. */
export function ChallengeBanner({ challenge, onPress }: { challenge: Challenge; onPress: () => void }) {
  const progress = Math.min(1, challenge.progress / challenge.target)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Défi de la semaine : ${challenge.title}. ${challenge.progress} sur ${challenge.target}. Ouvrir ton quartier`}
      className="mb-3 gap-2.5 rounded-2xl bg-forest p-4"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
    >
      <View className="flex-row items-center gap-2">
        <Users size={16} color="#B4DD7F" />
        <Text className="flex-1 font-raleway-semibold text-caption uppercase tracking-widest text-lime">
          Ton quartier · {daysLeftLabel(challenge.daysLeft)}
        </Text>
        <ChevronRight size={18} color="#F9F7E8" />
      </View>
      <Text className="font-poppins text-body text-sand" numberOfLines={2}>
        {challenge.title}
      </Text>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <SapProgressBar progress={progress} onDark />
        </View>
        <Text className="font-raleway-semibold text-caption" style={{ color: MUTED_ON_DARK }}>
          {challenge.progress} / {challenge.target}
        </Text>
      </View>
    </Pressable>
  )
}
