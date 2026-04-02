'use client'

import { Star } from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

interface Testimonial {
  initials: string
  quote: string
  name: string
  city: string
  gardenType: string
}

const testimonials: Testimonial[] = [
  {
    initials: 'JB',
    quote: "Grâce à Growi, mes plantes d'intérieur sont enfin épanouies !",
    name: 'Julie B.',
    city: 'Lyon',
    gardenType: 'Plantes intérieur 🌿',
  },
  {
    initials: 'MD',
    quote: 'Plus besoin de me demander quand tailler mes rosiers.',
    name: 'Marc D.',
    city: 'Bordeaux',
    gardenType: 'Jardin potager 🌹',
  },
  {
    initials: 'PL',
    quote: "Le rappel météo m'a sauvé mon potager.",
    name: 'Pierre L.',
    city: 'Nantes',
    gardenType: 'Potager 🍅',
  },
]

function StarRating() {
  return (
    <div className="flex gap-0.5" aria-label="5 étoiles sur 5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="fill-sun text-sun w-4 h-4" aria-hidden="true" />
      ))}
    </div>
  )
}

export function Testimonials() {
  return (
    <section className="bg-sand-dark py-20 md:py-28" aria-label="Témoignages">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl mb-4">
            Ils adorent Growi
          </h2>
          <p className="font-raleway text-forest/60 text-lg">
            +12 000 jardiniers nous font déjà confiance.
          </p>
        </div>

        <Carousel
          opts={{ align: 'start', loop: true }}
          className="w-full"
        >
          <CarouselContent className="-ml-4">
            {testimonials.map((t) => (
              <CarouselItem key={t.name} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <div className="bg-white rounded-2xl p-6 shadow-card h-full flex flex-col gap-4">
                  <StarRating />
                  <blockquote className="font-raleway italic text-forest/80 text-base leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full bg-lime flex items-center justify-center font-poppins font-bold text-forest text-sm shrink-0"
                      aria-hidden="true"
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div className="font-poppins font-semibold text-forest text-sm">{t.name}</div>
                      <div className="font-raleway text-forest/50 text-xs">
                        {t.city} · {t.gardenType}
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="hidden md:flex -left-12 border-forest/20 text-forest hover:bg-forest/10" />
          <CarouselNext className="hidden md:flex -right-12 border-forest/20 text-forest hover:bg-forest/10" />
        </Carousel>
      </div>
    </section>
  )
}
