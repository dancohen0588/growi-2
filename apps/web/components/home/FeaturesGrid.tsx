'use client'

import { Brain, Camera, CalendarDays, ShoppingBag, Users, Star } from 'lucide-react'
import { useReducedMotion, motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { staggerContainer, scaleIn } from '@/lib/animations'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  { icon: Brain,       title: 'Assistant intelligent',  description: "L'app adapte les conseils à ta météo locale." },
  { icon: Camera,      title: 'Diagnostic photo IA',    description: 'Identifie maladies et carences instantanément.' },
  { icon: CalendarDays,title: 'Calendrier du jardin',   description: 'Planifie semis, tailles et floraisons.' },
  { icon: ShoppingBag, title: 'Store contextuel',       description: "Trouve ce qu'il te faut au bon moment." },
  { icon: Users,       title: 'Communauté locale',      description: 'Partage tes réussites et tes plantes.' },
  { icon: Star,        title: 'Version Premium',        description: 'Diagnostic illimité + météo pro + multi-jardins.' },
]

export function FeaturesGrid() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="bg-sand py-20 md:py-28" aria-label="Fonctionnalités phares">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl mb-4">
            Tout pour bien jardiner
          </h2>
          <p className="font-raleway text-forest/60 text-lg max-w-xl mx-auto">
            Des fonctionnalités pensées pour chaque jardinier, du débutant au passionné.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial={shouldReduceMotion ? undefined : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, margin: '-80px' }}
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={feature.title}
                variants={shouldReduceMotion ? undefined : scaleIn}
              >
                <Card className="rounded-2xl border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300 bg-white h-full">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="w-12 h-12 rounded-xl bg-lime/20 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-forest" aria-hidden="true" />
                    </div>
                    <h3 className="font-poppins font-semibold text-forest text-lg">
                      {feature.title}
                    </h3>
                    <p className="font-raleway text-forest/70 text-base leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>

        <div className="flex justify-center mt-12">
          <Button variant="forest" asChild>
            <Link href="/fonctionnalites">Explorer toutes les fonctionnalités</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
