import type { Metadata } from 'next'
import { HeroFonctionnalites }  from './components/HeroFonctionnalites'
import { SectionCartographie }  from './components/SectionCartographie'
import { SectionAssistant }     from './components/SectionAssistant'
import { SectionDiagnostic }    from './components/SectionDiagnostic'
import { SectionCalendrier }    from './components/SectionCalendrier'
import { CTABottom }            from './components/CTABottom'

export const metadata: Metadata = {
  title: 'Fonctionnalités — Cartographie, Assistant, Diagnostic, Calendrier',
  description:
    "Cartographie, assistant météo, identification et diagnostic photo, calendrier des semis : découvre tout ce que Growi fait pour t'aider à jardiner.",
  openGraph: {
    title: 'Fonctionnalités Growi — Tout ce dont ton jardin a besoin, au bon moment',
    description:
      "Cartographie, assistant météo, identification et diagnostic photo, calendrier des semis : découvre tout ce que Growi fait pour t'aider à jardiner.",
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
