import { Redirect, Tabs } from 'expo-router'
import { CalendarDays, Camera, Leaf, LayoutDashboard, Users } from 'lucide-react-native'

import { usePushNotifications } from '@/lib/use-push'
import { useSession } from '@/store/session'

/**
 * Les cinq onglets : Accueil, Mes plantes, Identifier, Calendrier, Communauté.
 *
 * « Mon jardin » n'en fait plus partie. Un jardin est un **classement**, pas
 * une destination : on l'ouvrait pour y retrouver ses plantes, ce que
 * « Mes plantes » fait désormais avec son sélecteur de jardin. La place ainsi
 * libérée revient à la communauté, qu'on ouvre plusieurs fois par semaine et
 * qui vivait jusqu'ici à deux taps de l'accueil.
 *
 * Les écrans du jardin — liste, plan, création, ajout d'une plante — n'ont pas
 * disparu : leur pile reste montée, simplement retirée de la barre par
 * `href: null`, et on y navigue depuis « Mes plantes ». Les supprimer aurait
 * emporté le plan du jardin et la seule façon d'ajouter une plante.
 *
 * Le profil ne figure pas non plus dans la barre, faute de place : il s'ouvre
 * depuis l'en-tête de l'accueil, comme « Mon compte » vit dans la colonne du
 * web sans être une destination principale.
 */
export default function TabsLayout() {
  const status = useSession((s) => s.status)

  // Les notifications se branchent ici : c'est le premier écran qu'on ne voit
  // qu'une fois connecté, et il reste monté tant que la session dure.
  usePushNotifications(status === 'authenticated')

  // Session perdue en cours de route (jeton révoqué, rafraîchissement refusé) :
  // on repart vers la connexion sans laisser d'écran vide derrière.
  if (status !== 'authenticated') return <Redirect href="/(auth)/login" />

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1E5631',
        tabBarInactiveTintColor: 'hsl(139 20% 40%)',
        tabBarStyle: {
          backgroundColor: '#F9F7E8',
          borderTopColor: 'hsl(139 20% 80%)',
        },
        tabBarLabelStyle: {
          fontFamily: 'Raleway_500Medium',
          // Cinq libellés dans la largeur d'un iPhone SE : 11 pt évite la
          // troncature de « Mes plantes » et de « Communauté ».
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="accueil"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="plantes"
        options={{
          title: 'Mes plantes',
          tabBarIcon: ({ color, size }) => <Leaf color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="identifier"
        options={{
          title: 'Identifier',
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendrier"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="communaute"
        options={{
          title: 'Communauté',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />

      {/* Montée mais hors de la barre : le plan du jardin, la création d'un
          jardin et l'ajout d'une plante s'y trouvent, et on y accède depuis
          « Mes plantes ». */}
      <Tabs.Screen name="jardins" options={{ href: null }} />
    </Tabs>
  )
}
