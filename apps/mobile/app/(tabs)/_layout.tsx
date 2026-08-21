import { Redirect, Tabs } from 'expo-router'
import { CalendarDays, Camera, Leaf, LayoutDashboard, Map } from 'lucide-react-native'

import { useSession } from '@/store/session'

/**
 * Les cinq onglets, alignés sur la navigation du web : Accueil, Mon jardin,
 * Mes plantes, Calendrier, puis ce qui distingue chaque support — la caméra
 * ici, le diagnostic IA là-bas.
 *
 * Le profil n'y figure pas, faute de place : il s'ouvre depuis l'en-tête de
 * l'accueil, comme « Mon compte » vit dans la colonne du web sans être une
 * destination principale.
 */
export default function TabsLayout() {
  const status = useSession((s) => s.status)

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
          // troncature de « Mes plantes ».
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
        name="jardins"
        options={{
          title: 'Mon jardin',
          tabBarIcon: ({ color, size }) => <Map color={color} size={size} />,
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
        name="calendrier"
        options={{
          title: 'Calendrier',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="identifier"
        options={{
          title: 'Identifier',
          tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
