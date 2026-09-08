import { useRouter } from 'expo-router'

import { EmptyState } from '@/components/ui/states'

/**
 * L'invitation à rejoindre la communauté, montrée à la place du fil et de la
 * bourse tant que le profil public n'est pas activé.
 *
 * Le serveur refuse ces deux lectures en 403 — c'est le bon comportement, mais
 * un refus attendu n'est pas une panne : l'afficher en « une erreur est
 * survenue » laissait l'onglet Communauté cassé pour tout compte n'ayant jamais
 * choisi de pseudo. Pendant du `CommunityDisabled` du web
 * (`apps/web/components/community/bits.tsx`).
 */
export function CommunityDisabled() {
  const router = useRouter()

  return (
    <EmptyState
      emoji="🌱"
      title="Rejoins la communauté"
      message="Choisis un pseudo pour voir ce que publient les jardiniers autour de toi. Ton nom et ton adresse restent privés."
      cta={{
        label: 'Activer mon profil public',
        onPress: () => router.push('/(tabs)/communaute/activer'),
      }}
    />
  )
}
