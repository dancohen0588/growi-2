import type { Metadata } from 'next'
import { HeroFonctionnalites }  from './components/HeroFonctionnalites'
import { SectionCartographie }  from './components/SectionCartographie'
import { SectionAssistant }     from './components/SectionAssistant'
import { SectionDiagnostic }    from './components/SectionDiagnostic'
import { SectionCalendrier }    from './components/SectionCalendrier'
import { CTABottom }            from './components/CTABottom'

export const metadata: Metadata = {
  title: 'Fonctionnalités — Cartographie, Assistant IA, Diagnostic, Calendrier',
  description:
    "Découvre tout ce que Growi fait pour toi : carte de ton jardin, assistant météo, diagnostic IA et calendrier potager.",
  openGraph: {
    title: 'Fonctionnalités Growi — Tout pour bien jardiner',
    description:
      "Cartographie, IA, calendrier potager : explore toutes les fonctionnalités de Growi.",
  },
}

export default function FonctionnalitesPage() {
  return (
    <main>
      <HeroFonctionnalites />
      <SectionCartographie />
      <SectionAssistant />
      <SectionDiagnostic />
      <SectionCalendrier />
      <CTABottom />
    </main>
  )
}
