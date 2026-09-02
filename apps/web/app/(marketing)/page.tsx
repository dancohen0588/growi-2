import { HeroSection }         from '@/components/home/HeroSection'
import { HowItWorks }          from '@/components/home/HowItWorks'
import { PlantsNeeds }         from '@/components/home/PlantsNeeds'
import { FeaturesGrid }        from '@/components/home/FeaturesGrid'
import { EncyclopediaAndBlog } from '@/components/home/EncyclopediaAndBlog'
import { FinalCTA }            from '@/components/home/FinalCTA'

export const metadata = {
  title: 'Growi — Tes plantes, ta croissance',
  description:
    "L'assistant intelligent qui t'aide à entretenir ton jardin jour après jour, selon la météo et tes plantes.",
}

// `EncyclopediaAndBlog` lit le compteur du catalogue en base. Même cadence que
// `/encyclopedie` : la home reste statique, régénérée une fois par jour.
export const revalidate = 86400

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <PlantsNeeds />
      <FeaturesGrid />
      <EncyclopediaAndBlog />
      <FinalCTA />
    </main>
  )
}
