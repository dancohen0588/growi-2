import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import { SectionWrapper } from '@/components/ui/section-wrapper'
import { ContactForm } from '@/components/contact/ContactForm'
import { ContactInfo } from '@/components/contact/ContactInfo'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

export const metadata: Metadata = {
  title: 'Contact — Growi',
  description: "Une question sur tes plantes ou ton abonnement ? Écris-nous, on répond sous 48h.",
}

const FAQ_ITEMS = [
  {
    id: 'q1',
    question: 'Combien de temps pour une réponse ?',
    answer: 'On répond à tous les messages sous 48h, du lundi au vendredi.',
  },
  {
    id: 'q2',
    question: 'Puis-je joindre des photos de mes plantes ?',
    answer: "Pas encore depuis ce formulaire, mais tu peux décrire les symptômes en détail dans ton message.",
  },
  {
    id: 'q3',
    question: "Que faire si je n'ai pas reçu de réponse ?",
    answer: "Vérifie ton dossier spam, puis renvoie-nous un message — on ne laisse personne sans réponse !",
  },
]

export default function ContactPage() {
  return (
    <>
      <Toaster position="bottom-right" richColors />

      {/* Hero */}
      <section className="bg-sand py-16 md:py-24 relative overflow-hidden">
        {/* Decorative background blobs */}
        <div
          aria-hidden
          className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-gradient-to-br from-lime/20 to-forest/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden
          className="absolute bottom-0 right-0 w-56 h-56 rounded-full bg-gradient-to-tl from-sun/15 to-lime/10 blur-2xl pointer-events-none"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lime/20 text-3xl mb-6" aria-hidden>
            🌱
          </div>
          <h1 className="font-poppins font-bold text-forest text-4xl md:text-5xl mb-4 leading-tight">
            On est là pour toi
          </h1>
          <p className="font-raleway text-forest/70 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Une question, un souci avec tes plantes, ou juste envie de nous dire bonjour&nbsp;?
            Écris-nous, on répond sous 48h.
          </p>
        </div>
      </section>

      {/* Form + Info */}
      <SectionWrapper variant="white" aria-label="Formulaire de contact">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-10">
          <ContactForm />
          <ContactInfo />
        </div>
      </SectionWrapper>

      {/* FAQ */}
      <SectionWrapper variant="sand" aria-label="Questions fréquentes">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-poppins font-semibold text-forest text-2xl mb-8 text-center">
            Questions fréquentes
          </h2>
          <Accordion type="single">
            {FAQ_ITEMS.map(item => (
              <AccordionItem key={item.id} value={item.id}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SectionWrapper>
    </>
  )
}
