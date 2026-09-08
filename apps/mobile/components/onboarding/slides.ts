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
    text: "L'assistant de ton jardin : suis tes plantes, sache quoi faire et quand, identifie n'importe quelle plante en photo — et rencontre les jardiniers autour de toi.",
    tone: 'light',
  },
  {
    id: 'plantes',
    image: require('../../assets/onboarding/onboarding-02-plantes.png'),
    title: 'Chaque plante, suivie de près',
    text: "Toutes tes plantes, jardin par jardin ou d'un seul coup d'œil : santé, arrosage, historique — et Growi te prévient quand l'une d'elles a soif.",
    tone: 'light',
  },
  {
    id: 'calendrier',
    image: require('../../assets/onboarding/onboarding-03-calendrier.png'),
    title: 'Quoi faire, et quand le faire',
    text: "Growi range tes gestes : l'arrosage du jour d'un côté, ce qui peut attendre de l'autre. Tout arrosé ? Un seul tap.",
    tone: 'light',
  },
  {
    id: 'identifier',
    image: require('../../assets/onboarding/onboarding-04-identifier.png'),
    title: 'Identifie une plante en photo',
    text: 'Prends-la en photo : Growi la reconnaît, te donne ses besoins et diagnostique ses problèmes.',
    tone: 'light',
  },
  {
    id: 'communaute',
    image: require('../../assets/onboarding/onboarding-05-communaute.png'),
    title: 'Des jardiniers, tout près de chez toi',
    text: 'Partage tes plantes, suis tes voisins, donne ou cherche des graines et des boutures — sans argent, sans révéler ton adresse.',
    tone: 'dark',
  },
]
