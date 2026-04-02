import Link from 'next/link'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const checkpoints = [
  "Planning d'entretien intelligent",
  'Rapports photo & conformité',
  'Suivi arrosage & biodiversité',
]

function LaptopMockup() {
  return (
    <div className="w-full max-w-sm mx-auto" aria-hidden="true">
      {/* Lid */}
      <div className="bg-forest/20 rounded-t-xl border-2 border-forest/20 overflow-hidden" style={{ paddingBottom: '62.5%', position: 'relative' }}>
        <div className="absolute inset-1 bg-forest rounded-lg flex flex-col overflow-hidden">
          {/* Screen header */}
          <div className="bg-forest-light px-3 py-2 flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-forest/40 rounded h-3" />
          </div>
          {/* KPI tiles */}
          <div className="flex-1 p-3 grid grid-cols-2 gap-2">
            {[
              { label: 'Sites actifs', value: '24' },
              { label: 'OTs clôturés', value: '98%' },
              { label: 'Eau économisée', value: '−18%' },
              { label: 'NPS client',    value: '72' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-forest-light rounded-lg p-2 flex flex-col">
                <span className="text-white/50 text-[9px]">{kpi.label}</span>
                <span className="text-lime font-poppins font-bold text-base">{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Base */}
      <div className="h-3 bg-forest/20 border-x-2 border-b-2 border-forest/20 rounded-b-sm mx-4" />
      <div className="h-1.5 bg-forest/10 rounded-b-full mx-2" />
    </div>
  )
}

export function ProSection() {
  return (
    <section className="bg-white py-20 md:py-28" aria-label="Growi Pro">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: text */}
          <div className="flex flex-col gap-6">
            <Badge className="w-fit bg-forest text-white font-poppins text-xs px-3 py-1">
              Pour les professionnels
            </Badge>
            <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl">
              Pilotez vos espaces verts, simplement.
            </h2>
            <p className="font-raleway text-forest/70 text-lg leading-relaxed">
              Growi Pro est conçu pour les syndics, collectivités et prestataires
              qui gèrent des dizaines de sites.
            </p>

            <ul className="flex flex-col gap-4">
              {checkpoints.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 border-l-4 border-lime pl-4"
                >
                  <Check className="w-5 h-5 text-lime mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="font-raleway text-forest text-base">{item}</span>
                </li>
              ))}
            </ul>

            <Button variant="forest" size="lg" className="w-fit" asChild>
              <Link href="/pro">Découvrir Growi Pro</Link>
            </Button>
          </div>

          {/* Right: laptop mockup */}
          <div>
            <LaptopMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
