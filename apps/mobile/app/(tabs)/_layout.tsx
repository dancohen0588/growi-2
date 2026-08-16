import { Tabs } from 'expo-router'
import { Camera, Leaf, Sun, User } from 'lucide-react-native'

/**
 * Les quatre onglets du MVP. « Aujourd'hui » est l'écran d'accueil : c'est la
 * question à laquelle l'app répond en premier — qu'est-ce que je fais
 * aujourd'hui dans mon jardin.
 */
export default function TabsLayout() {
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
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Aujourd'hui",
          tabBarIcon: ({ color, size }) => <Sun color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jardins"
        options={{
          title: 'Jardins',
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
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
