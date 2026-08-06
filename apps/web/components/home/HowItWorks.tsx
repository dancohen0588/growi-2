'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { Sprout, Bell, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { staggerContainer, scaleIn } from '@/lib/animations'

const steps = [
  {
    number: '01',
    icon: Sprout,
    title: 'Identifie tes plantes',
    description: 'Prends une photo ou choisis dans la base de données.',
  },
  {
    number: '02',
    icon: Bell,
    title: 'Reçois les bons rappels',
    description: 'Arrosage, rempotage, taille, selon ton climat.',
  },
  {
    number: '03',
    icon: Sun,
    title: 'Fais-les prospérer',
    description: "Des conseils adaptés à la météo et au moment de l'année.",
  },
]

export function HowItWorks() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="bg-white py-20 md:py-28" aria-label="Comment ça marche">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl mb-4">
            Comment ça marche ?
          </h2>
          <p className="font-raleway text-forest/60 text-lg max-w-xl mx-auto">
            En 3 étapes, ton jardin devient plus simple à gérer.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, margin: '-80px' }}
        >
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.number}
                variants={shouldReduceMotion ? undefined : scaleIn}
                className="flex flex-col items-center text-center gap-4"
              >
                {/* Number circle */}
                <div className="w-12 h-12 rounded-full bg-lime text-forest font-poppins font-bold text-lg flex items-center justify-center">
                  {step.number}
                </div>
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-lime/10 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-forest" aria-hidden="true" />
                </div>
                <h3 className="font-poppins font-semibold text-forest text-xl">
                  {step.title}
                </h3>
                <p className="font-raleway text-forest/60 text-base leading-relaxed max-w-xs">
                  {step.description}
                </p>
              </motion.div>
            )
          })}
        </motion.div>

        <div className="flex justify-center mt-12">
          <Button variant="outline" asChild>
            <Link href="/fonctionnalites">Découvrir toutes les fonctionnalités</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
