'use client'

import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { useReducedMotion, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { fadeUp, staggerContainer } from '@/lib/animations'

interface PlanFeature {
  label: string
  free: boolean | string
  premium: boolean | string
  pro: boolean | string
}

const features: PlanFeature[] = [
  { label: 'Identification photo plantes',          free: true,       premium: true,        pro: true },
  { label: 'Rappels arrosage & entretien',           free: true,       premium: true,        pro: true },
  { label: 'Calendrier potager',                     free: 'Basique',  premium: 'Complet',   pro: 'Complet' },
  { label: 'Diagnostic maladies/nuisibles',          free: '3/mois',   premium: 'Illimité',  pro: 'Illimité' },
  { label: 'Météo pro (72h précise)',                 free: false,      premium: true,        pro: true },
  { label: 'Multi-jardins',                          free: '1 jardin', premium: '5 jardins', pro: 'Illimité' },
  { label: 'Export PDF rapport',                     free: false,      premium: true,        pro: true },
  { label: 'Télé-conseil expert',                    free: false,      premium: '1 session', pro: 'Illimité' },
  { label: 'Accès marketplace services',             free: true,       premium: true,        pro: true },
  { label: 'Recommandations produits intelligentes', free: false,      premium: true,        pro: true },
]

const plans = [
  { key: 'free',    label: 'Gratuit',    price: '0 €',    period: 'pour toujours', cta: 'Commence maintenant', href: '/tarifs', highlight: false },
  { key: 'premium', label: 'Premium',    price: '4,99 €', period: 'par mois',      cta: 'Essaie 14 jours',     href: '/tarifs', highlight: true },
  { key: 'pro',     label: 'Pro Jardin', price: '9,99 €', period: 'par mois',      cta: 'Démarrer Pro',        href: '/tarifs', highlight: false },
]

function Cell({ value }: { value: boolean | string }) {
  if (value === true)  return <Check className="w-5 h-5 text-lime mx-auto" aria-label="Inclus" />
  if (value === false) return <X     className="w-5 h-5 text-white/30 mx-auto" aria-label="Non inclus" />
  return <span className="text-white/80 text-sm font-raleway">{value}</span>
}

export function SectionPremium() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section
      id="premium"
      aria-label="Comparatif des offres Premium"
      className="bg-forest py-20 md:py-28"
    >
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-12"
        variants={shouldReduceMotion ? undefined : staggerContainer}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'visible'}
        viewport={{ once: true, margin: '-100px' }}
      >
        <motion.div
          className="text-center flex flex-col gap-4"
          variants={shouldReduceMotion ? undefined : fadeUp}
        >
          <span className="inline-block font-poppins font-semibold text-sm text-forest bg-lime px-4 py-1.5 rounded-full w-fit mx-auto">
            Offres
          </span>
          <h2 className="font-poppins font-bold text-white text-3xl md:text-4xl">
            Choisis ce qui correspond à ton jardin
          </h2>
          <p className="font-raleway text-white/70 text-lg max-w-xl mx-auto">
            Commence gratuitement, passe Premium quand tu veux — sans engagement.
          </p>
        </motion.div>

        <motion.div
          className="w-full overflow-x-auto"
          variants={shouldReduceMotion ? undefined : fadeUp}
        >
          <table className="w-full min-w-[600px] border-collapse">
            <caption className="sr-only">Comparatif des offres Growi : Gratuit, Premium et Pro Jardin</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left font-poppins font-semibold text-white/60 text-sm pb-6 pr-4 w-1/2">
                  Fonctionnalité
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.key}
                    scope="col"
                    className={`text-center pb-6 px-4 ${plan.highlight ? 'relative' : ''}`}
                  >
                    {plan.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-lime text-forest text-xs font-poppins font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                        Populaire
                      </span>
                    )}
                    <span className="block font-poppins font-bold text-white text-lg">{plan.label}</span>
                    <span className="block font-poppins font-bold text-lime text-2xl mt-1">{plan.price}</span>
                    <span className="block font-raleway text-white/50 text-sm">{plan.period}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, i) => (
                <tr key={feature.label} className={i % 2 === 0 ? 'bg-white/5' : ''}>
                  <td className="font-raleway text-white/80 text-sm py-3.5 pr-4 rounded-l-lg pl-3">
                    {feature.label}
                  </td>
                  <td className="text-center py-3.5 px-4">
                    <Cell value={feature.free} />
                  </td>
                  <td className="text-center py-3.5 px-4 bg-lime/10">
                    <Cell value={feature.premium} />
                  </td>
                  <td className="text-center py-3.5 px-4 rounded-r-lg">
                    <Cell value={feature.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                {plans.map((plan) => (
                  <td key={plan.key} className="text-center pt-6 px-4">
                    <Button
                      variant={plan.highlight ? 'primary' : 'outline'}
                      size="sm"
                      asChild
                      className={plan.highlight ? '' : 'border-white/40 text-white hover:bg-white/10'}
                    >
                      <Link href={plan.href}>{plan.cta}</Link>
                    </Button>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </motion.div>
      </motion.div>
    </section>
  )
}
