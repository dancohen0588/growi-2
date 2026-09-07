import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

/**
 * En-tête des écrans de la communauté.
 *
 * Deux choses qu'on ne peut pas obtenir en recopiant un chevron dans chaque
 * écran :
 *
 * 1. **La racine d'un onglet n'a pas de retour.** Le fil est atteint en tapant
 *    « Communauté » dans la barre ; un chevron y proposerait de quitter un
 *    écran qu'on vient d'ouvrir, vers un endroit indéterminé. Sans `parent`,
 *    l'en-tête n'affiche rien à gauche.
 *
 * 2. **Le retour remonte d'un niveau, il ne défait pas l'historique.**
 *    `router.back()` ramène là d'où l'on vient, ce qui n'est pas la même chose :
 *    en ouvrant une annonce depuis un fil de discussion, il renvoyait au fil ;
 *    en arrivant par une notification, il n'y avait rien derrière. `navigate`
 *    vers le parent déclaré remonte au bon écran quel que soit le chemin
 *    emprunté — et, si ce parent est déjà dans la pile, y revient au lieu de
 *    l'empiler une seconde fois.
 */
export interface CommunityHeaderProps {
  title: string
  /** Écran du niveau supérieur. Absent ⇒ racine d'onglet, pas de retour. */
  parent?: Href
  /** Actions à droite du titre. */
  children?: ReactNode
}

export function CommunityHeader({ title, parent, children }: CommunityHeaderProps) {
  const router = useRouter()

  return (
    <View className="flex-row items-center gap-2 px-4 py-3">
      {parent ? (
        <Pressable
          onPress={() => router.navigate(parent)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>
      ) : null}

      <Text className="flex-1 font-poppins-bold text-screen text-forest" numberOfLines={1}>
        {title}
      </Text>

      {children}
    </View>
  )
}
