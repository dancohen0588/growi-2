import type { ImageSourcePropType } from 'react-native'

/**
 * Contenu de la présentation du premier lancement.
 *
 * Les textes vivent ici et non dans les images : ils suivent ainsi le Dynamic
 * Type, restent nets sur tous les écrans, et pourront être traduits sans
 * refaire les visuels.
 *
 * Règle d'écriture : le mot « IA » n'apparaît jamais — c'est « Growi » qui
 * reconnaît, conseille et prévient.
 */
export interface OnboardingSlideContent {
  id: string
  image: ImageSourcePropType
  title: string
  text: string
  /** `dark` = fond forest, texte sand. Seul le dernier écran s'y met. */
  tone: 'light' | 'dark'
}

export const SLIDES: OnboardingSlideContent[] = [
  {
    id: 'bienvenue',
    image: require('../../assets/onboarding/onboarding-01-bienvenue.png'),
    title: 'Bienvenue sur Growi 🌿',
    text: "L'assistant de ton jardin : suis tes plantes, sache quoi faire et quand, et identifie n'importe quelle plante en photo.",
    tone: 'light',
  },
  {
    id: 'jardin',
    image: require('../../assets/onboarding/onboarding-02-jardin.png'),
    title: 'Organise ton jardin, plante par plante',
    text: 'Crée tes jardins, intérieur comme extérieur, et retrouve chaque plante à sa place.',
    tone: 'light',
  },
  {
    id: 'plantes',
    image: require('../../assets/onboarding/onboarding-03-plantes.png'),
    title: 'Chaque plante, suivie de près',
    text: 'Santé, arrosage, historique des soins : tout est sous contrôle, et Growi te prévient quand une plante a soif.',
    tone: 'light',
  },
  {
    id: 'calendrier',
    image: require('../../assets/onboarding/onboarding-04-calendrier.png'),
    title: 'Quoi faire, et quand le faire',
    text: 'Arrosage, semis, récolte : Growi planifie tes gestes et te les rappelle au bon moment.',
    tone: 'light',
  },
  {
    id: 'identifier',
    image: require('../../assets/onboarding/onboarding-05-identifier.png'),
    title: 'Identifie une plante en photo',
    text: 'Prends-la en photo : Growi la reconnaît, te donne ses besoins et diagnostique ses problèmes.',
    tone: 'dark',
  },
]
