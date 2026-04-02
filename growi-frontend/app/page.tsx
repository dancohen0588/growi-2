import { HeroSection }  from '@/components/home/HeroSection'
import { HowItWorks }   from '@/components/home/HowItWorks'
import { AppPreview }   from '@/components/home/AppPreview'
import { FeaturesGrid } from '@/components/home/FeaturesGrid'
import { Testimonials } from '@/components/home/Testimonials'
import { ProSection }   from '@/components/home/ProSection'
import { FinalCTA }     from '@/components/home/FinalCTA'

export const metadata = {
  title: 'Growi — Ton assistant jardin intelligent',
  description:
    "L'application qui t'aide à entretenir ton jardin, guidée par la météo et l'IA.",
}

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <AppPreview />
      <FeaturesGrid />
      <Testimonials />
      <ProSection />
      <FinalCTA />
    </main>
  )
}
