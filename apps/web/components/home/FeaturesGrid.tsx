'use client'

import { Brain, Bell, Camera, CalendarDays, MessageSquare, Map } from 'lucide-react'
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
  /** Ancre de la section correspondante sur `/fonctionnalites`. */
  href: string
  tag?: string
}

/**
 * Store contextuel, Communauté locale et Version Premium décrivaient des
 * fonctions qui n'existent pas : trois cartes sur six. Les six ci-dessous sont
 * toutes livrées, et chacune mène à la section qui la détaille.
 */
const features: Feature[] = [
  {
    icon: Brain,
    title: 'Assistant météo',
    description: 'Des conseils adaptés à chaque plante, à la saison et à la météo de ton code postal.',
    href: '/fonctionnalites#assistant',
  },
  {
    icon: Bell,
    title: 'Rappels au bon moment',
    description: 'Arrosage, taille, semis, gel annoncé : une notification quand ça compte, pas en excès.',
    href: '/fonctionnalites#assistant',
  },
  {
    icon: Camera,
    title: 'Identification & diagnostic photo',
    description: 'Reconnais une plante, repère une maladie ou une carence, et reçois un plan de soin.',
    href: '/fonctionnalites#diagnostic',
  },
  {
    icon: CalendarDays,
    title: 'Calendrier du jardin',
    description: 'Semis, taille, récolte et rempotage, calés sur ta région et ajustés à la météo réelle.',
    href: '/fonctionnalites#calendrier',
  },
  {
    icon: MessageSquare,
    title: 'Assistant qui répond',
    description: 'Une question sur un geste, un diagnostic, une plante ? Il répond avec le contexte, propose — tu décides.',
    href: '/fonctionnalites#assistant',
    tag: 'Nouveau',
  },
  {
    icon: Map,
    title: 'Plan du jardin & journal',
    description: "Dessine tes zones, place tes plantes, garde l'historique de chaque geste.",
    href: '/fonctionnalites#cartographie',
  },
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
                className="h-full"
              >
                <Link
                  href={feature.href}
                  className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
                >
                  <Card className="rounded-2xl border-0 shadow-card hover:shadow-card-hover transition-shadow duration-300 bg-white h-full">
                    <CardContent className="p-6 flex flex-col gap-4">
                      <div className="w-12 h-12 rounded-xl bg-lime/20 flex items-center justify-center">
                        <Icon className="w-6 h-6 text-forest" aria-hidden="true" />
                      </div>
                      <h3 className="font-poppins font-semibold text-forest text-lg">
                        {feature.title}
                        {feature.tag && (
                          <span className="ml-2 align-middle rounded-md bg-lime/25 px-1.5 py-0.5 font-poppins text-[10.5px] uppercase tracking-wider text-forest">
                            {feature.tag}
                          </span>
                        )}
                      </h3>
                      <p className="font-raleway text-forest/70 text-base leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
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
