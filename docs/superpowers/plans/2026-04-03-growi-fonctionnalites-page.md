# Growi — Page `/fonctionnalites` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static page `app/fonctionnalites/page.tsx` — 8 sections présentant les fonctionnalités de Growi en tutoiement, avec alternance texte/visuel, tableau comparatif Premium et liens d'ancre smooth scroll.

**Architecture:** Page purement statique (Server Components + Client Components ciblés pour animation). Les composants vivent dans `app/fonctionnalites/components/` (scoped à la route). Un composant partagé `GardenImagePlaceholder` encapsule tous les visuels CSS. Le `SectionWrapper` existant est réutilisé pour la cohérence layout/motion.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui · Framer Motion · lucide-react · `components/ui/button.tsx` (variants existants) · `components/ui/section-wrapper.tsx`

---

## File Map

| Fichier | Responsabilité |
|---------|---------------|
| `app/fonctionnalites/page.tsx` | Assemblage des 8 sections + metadata SEO |
| `app/fonctionnalites/components/HeroFonctionnalites.tsx` | Hero pleine largeur, titre, sous-titre, 6 liens d'ancre |
| `app/fonctionnalites/components/GardenImagePlaceholder.tsx` | Composant réutilisable : placeholder CSS stylisé avec `aria-label` + commentaire prompt IA |
| `app/fonctionnalites/components/SectionFeature.tsx` | Composant générique : layout texte/visuel alternant gauche-droite (réutilisé par 5 sections) |
| `app/fonctionnalites/components/SectionCartographie.tsx` | Props data → SectionFeature (texte gauche) |
| `app/fonctionnalites/components/SectionAssistant.tsx` | Props data → SectionFeature (visuel gauche) |
| `app/fonctionnalites/components/SectionDiagnostic.tsx` | Props data → SectionFeature (texte gauche) |
| `app/fonctionnalites/components/SectionCalendrier.tsx` | Props data → SectionFeature (visuel gauche) |
| `app/fonctionnalites/components/SectionMarketplace.tsx` | Props data → SectionFeature (texte gauche) |
| `app/fonctionnalites/components/SectionPremium.tsx` | Pleine largeur fond forest, tableau comparatif Free vs Premium |
| `app/fonctionnalites/components/CTABottom.tsx` | Gradient lime→forest, 2 CTAs |
| `public/images/fonctionnalites/.gitkeep` | Dossier vide pour images de production futures |

---

## Task 1 : Créer le dossier public et le fichier `.gitkeep`

**Files:**
- Create: `public/images/fonctionnalites/.gitkeep`

- [ ] **Step 1 : Créer le fichier**

```bash
mkdir -p /Users/dancohen/Documents/Travail/IA/Growi/growi-2/growi-frontend/public/images/fonctionnalites
touch /Users/dancohen/Documents/Travail/IA/Growi/growi-2/growi-frontend/public/images/fonctionnalites/.gitkeep
```

Expected : dossier `public/images/fonctionnalites/` présent, `.gitkeep` vide dedans.

- [ ] **Step 2 : Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2/growi-frontend
git add public/images/fonctionnalites/.gitkeep
git commit -m "chore: add public/images/fonctionnalites placeholder dir"
```

---

## Task 2 : GardenImagePlaceholder

**Files:**
- Create: `app/fonctionnalites/components/GardenImagePlaceholder.tsx`

Ce composant est **Server Component** (pas de `'use client'`). Il rend un rectangle CSS stylisé avec des éléments décoratifs SVG inline et un commentaire indiquant le prompt IA pour l'image de production.

- [ ] **Step 1 : Créer le composant**

```tsx
// app/fonctionnalites/components/GardenImagePlaceholder.tsx

import { cn } from '@/lib/utils'

interface GardenImagePlaceholderProps {
  /** Identifiant de la section — détermine le visuel CSS et le prompt IA */
  variant: 'cartographie' | 'assistant' | 'diagnostic' | 'calendrier' | 'marketplace'
  className?: string
}

const variantConfig: Record<
  GardenImagePlaceholderProps['variant'],
  { bg: string; accent: string; icon: string; label: string; prompt: string }
> = {
  cartographie: {
    bg: 'from-forest/10 to-lime/20',
    accent: 'bg-forest',
    icon: '🗺️',
    label: 'Aperçu cartographie du jardin',
    // AI_IMAGE_PROMPT: "Top-down illustrated garden map divided into zones (lawn, vegetable patch, terrace, flower beds). Soft watercolor style, lime green and forest green palette, sunlight, clean white background. Mobile app UI overlay showing zone labels."
    prompt: 'Carte illustrée du jardin avec zones colorées',
  },
  assistant: {
    bg: 'from-lime/20 to-sand',
    accent: 'bg-lime',
    icon: '🤖',
    label: "Aperçu de l'assistant IA",
    // AI_IMAGE_PROMPT: "Mobile app screenshot showing a smart garden assistant chat interface. Plant care advice bubble, weather icon, watering reminder. Warm beige background, forest green typography. Flat UI illustration style."
    prompt: "Interface de l'assistant intelligent",
  },
  diagnostic: {
    bg: 'from-sun/20 to-lime/10',
    accent: 'bg-sun',
    icon: '🔬',
    label: 'Aperçu diagnostic IA maladies',
    // AI_IMAGE_PROMPT: "Close-up of a plant leaf with disease detection overlay circles. Mobile camera viewfinder UI, diagnostic result card below with disease name and treatment advice. Nature photography + app UI composite."
    prompt: 'Diagnostic photo avec cercles de détection',
  },
  calendrier: {
    bg: 'from-forest/10 to-sun/10',
    accent: 'bg-forest',
    icon: '📅',
    label: 'Aperçu calendrier potager',
    // AI_IMAGE_PROMPT: "Mobile app calendar view showing monthly garden tasks: sowing dates, pruning, watering. Illustrated vegetable icons per task row. Soft pastel colors, lime green highlights. Clean flat design."
    prompt: 'Calendrier potager avec tâches illustrées',
  },
  marketplace: {
    bg: 'from-lime/10 to-sand',
    accent: 'bg-lime',
    icon: '🛍️',
    label: 'Aperçu marketplace services',
    // AI_IMAGE_PROMPT: "Mobile app marketplace screen showing garden service cards: pruning, irrigation, planting. Provider avatar, rating stars, price badge. Warm white background, forest green CTA buttons. Modern card UI."
    prompt: 'Marketplace de services jardinage',
  },
}

export function GardenImagePlaceholder({
  variant,
  className,
}: GardenImagePlaceholderProps) {
  const config = variantConfig[variant]

  return (
    <div
      role="img"
      aria-label={config.label}
      className={cn(
        'relative rounded-3xl overflow-hidden',
        'bg-gradient-to-br',
        config.bg,
        'aspect-[4/3] w-full',
        'flex flex-col items-center justify-center gap-4',
        'border border-forest/10 shadow-card',
        className
      )}
    >
      {/* Decorative circles */}
      <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-white/30 blur-xl" aria-hidden="true" />
      <div className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-white/20 blur-lg" aria-hidden="true" />

      {/* Icon badge */}
      <div
        className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-card',
          config.accent,
          'bg-opacity-20'
        )}
        aria-hidden="true"
      >
        {config.icon}
      </div>

      {/* Label */}
      <p className="font-raleway text-sm text-forest/50 px-4 text-center" aria-hidden="true">
        {config.prompt}
      </p>

      {/* Corner badge "Aperçu" */}
      <span className="absolute top-3 left-3 bg-white/80 text-forest text-xs font-poppins font-semibold px-2 py-1 rounded-full">
        Aperçu
      </span>
    </div>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2/growi-frontend
git add app/fonctionnalites/components/GardenImagePlaceholder.tsx
git commit -m "feat(fonctionnalites): add GardenImagePlaceholder component"
```

---

## Task 3 : SectionFeature — composant générique texte/visuel alternant

**Files:**
- Create: `app/fonctionnalites/components/SectionFeature.tsx`

Ce composant est `'use client'` pour Framer Motion. Il accepte `reverse?: boolean` pour alterner l'ordre texte/visuel.

- [ ] **Step 1 : Créer le composant**

```tsx
// app/fonctionnalites/components/SectionFeature.tsx
'use client'

import { useReducedMotion, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { fadeUp, scaleIn, staggerContainer } from '@/lib/animations'
import type { LucideIcon } from 'lucide-react'

interface FeaturePoint {
  icon: LucideIcon
  label: string
}

interface SectionFeatureProps {
  id: string
  /** Fond de section : 'sand' | 'white' */
  bg?: 'sand' | 'white'
  eyebrow: string
  title: string
  description: string
  points: FeaturePoint[]
  /** Slot visuel — passe GardenImagePlaceholder ou autre */
  visual: React.ReactNode
  /** Si true : visuel à gauche, texte à droite */
  reverse?: boolean
  'aria-label'?: string
}

export function SectionFeature({
  id,
  bg = 'sand',
  eyebrow,
  title,
  description,
  points,
  visual,
  reverse = false,
  'aria-label': ariaLabel,
}: SectionFeatureProps) {
  const shouldReduceMotion = useReducedMotion()

  const textCol = (
    <motion.div
      className="flex flex-col gap-6"
      variants={shouldReduceMotion ? undefined : fadeUp}
    >
      <span className="inline-block font-poppins font-semibold text-sm text-lime bg-forest/90 px-3 py-1 rounded-full w-fit">
        {eyebrow}
      </span>
      <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl leading-tight">
        {title}
      </h2>
      <p className="font-raleway text-forest/70 text-lg leading-relaxed">
        {description}
      </p>
      <ul className="flex flex-col gap-3" aria-label="Points clés">
        {points.map((point) => {
          const Icon = point.icon
          return (
            <li key={point.label} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-lime/20 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-forest" aria-hidden="true" />
              </span>
              <span className="font-raleway text-forest/80 text-base">{point.label}</span>
            </li>
          )
        })}
      </ul>
    </motion.div>
  )

  const visualCol = (
    <motion.div
      variants={shouldReduceMotion ? undefined : scaleIn}
    >
      {visual}
    </motion.div>
  )

  return (
    <section
      id={id}
      aria-label={ariaLabel ?? title}
      className={cn('py-20 md:py-28', bg === 'sand' ? 'bg-sand' : 'bg-white')}
    >
      <motion.div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        variants={shouldReduceMotion ? undefined : staggerContainer}
        initial={shouldReduceMotion ? undefined : 'hidden'}
        whileInView={shouldReduceMotion ? undefined : 'visible'}
        viewport={{ once: true, margin: '-100px' }}
      >
        <div
          className={cn(
            'grid grid-cols-1 md:grid-cols-2 gap-12 items-center',
            reverse ? 'md:[&>*:first-child]:order-2 md:[&>*:last-child]:order-1' : ''
          )}
        >
          {reverse ? (
            <>
              {visualCol}
              {textCol}
            </>
          ) : (
            <>
              {textCol}
              {visualCol}
            </>
          )}
        </div>
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/fonctionnalites/components/SectionFeature.tsx
git commit -m "feat(fonctionnalites): add generic SectionFeature layout component"
```

---

## Task 4 : HeroFonctionnalites

**Files:**
- Create: `app/fonctionnalites/components/HeroFonctionnalites.tsx`

Hero **Server Component** (pas d'animation Framer Motion — le Hero reste statique pour performance). Les 6 liens d'ancre utilisent `href="#id"` avec CSS `scroll-behavior: smooth` déjà natif sur `<html>` (géré ci-dessous dans `page.tsx`).

- [ ] **Step 1 : Créer le composant**

```tsx
// app/fonctionnalites/components/HeroFonctionnalites.tsx

import Link from 'next/link'
import { Button } from '@/components/ui/button'

const anchorLinks = [
  { href: '#cartographie', label: 'Cartographie' },
  { href: '#assistant',    label: 'Assistant IA' },
  { href: '#diagnostic',   label: 'Diagnostic' },
  { href: '#calendrier',   label: 'Calendrier' },
  { href: '#marketplace',  label: 'Marketplace' },
  { href: '#premium',      label: 'Premium' },
]

export function HeroFonctionnalites() {
  return (
    <section
      className="bg-gradient-to-br from-sand via-sand to-lime/30 py-20 md:py-28"
      aria-label="Présentation des fonctionnalités"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center gap-8">

        {/* Eyebrow */}
        <span className="inline-block font-poppins font-semibold text-sm text-lime bg-forest/90 px-4 py-1.5 rounded-full">
          Ce que Growi fait pour toi
        </span>

        {/* Title */}
        <h1 className="font-poppins font-bold text-forest text-4xl md:text-[3.25rem] leading-tight max-w-3xl">
          Tout ce dont ton jardin a besoin, au bon moment
        </h1>

        {/* Subtitle */}
        <p className="font-raleway text-forest/70 text-xl max-w-2xl leading-relaxed">
          De la cartographie de tes espaces à la mise en relation avec des pros,
          Growi t'accompagne à chaque saison — sans que tu aies à tout gérer seul.
        </p>

        {/* Primary CTA */}
        <Button variant="primary" size="lg" asChild>
          <Link href="/tarifs">Essaie gratuitement</Link>
        </Button>

        {/* Anchor links */}
        <nav aria-label="Navigation rapide dans la page" className="flex flex-wrap justify-center gap-2 mt-2">
          {anchorLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-forest/10 shadow-card font-raleway font-semibold text-sm text-forest hover:bg-lime/10 hover:border-lime transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/fonctionnalites/components/HeroFonctionnalites.tsx
git commit -m "feat(fonctionnalites): add HeroFonctionnalites with anchor nav"
```

---

## Task 5 : SectionCartographie, SectionAssistant, SectionDiagnostic, SectionCalendrier, SectionMarketplace

**Files:**
- Create: `app/fonctionnalites/components/SectionCartographie.tsx`
- Create: `app/fonctionnalites/components/SectionAssistant.tsx`
- Create: `app/fonctionnalites/components/SectionDiagnostic.tsx`
- Create: `app/fonctionnalites/components/SectionCalendrier.tsx`
- Create: `app/fonctionnalites/components/SectionMarketplace.tsx`

Chaque section instancie `SectionFeature` avec ses propres données. L'alternance droite/gauche est contrôlée par `reverse`.

Règle d'alternance :
- `SectionCartographie` (odd) → `reverse={false}` — texte gauche, visuel droite
- `SectionAssistant` (even) → `reverse={true}` — visuel gauche, texte droite
- `SectionDiagnostic` (odd) → `reverse={false}`
- `SectionCalendrier` (even) → `reverse={true}`
- `SectionMarketplace` (odd) → `reverse={false}`

- [ ] **Step 1 : Créer SectionCartographie.tsx**

```tsx
// app/fonctionnalites/components/SectionCartographie.tsx

import { Map, Layers, Sun, Droplets } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Map,      label: 'Crée le plan de ton jardin en quelques minutes' },
  { icon: Layers,   label: 'Zone par zone : pelouse, massifs, potager, terrasse' },
  { icon: Sun,      label: "Analyse automatique de l'exposition et des micro-climats" },
  { icon: Droplets, label: 'Suggestions d\'arrosage par zone selon la météo locale' },
]

export function SectionCartographie() {
  return (
    <SectionFeature
      id="cartographie"
      bg="white"
      eyebrow="Cartographie"
      title="Visualise et organise ton jardin comme un pro"
      description="Dessine ton espace en quelques gestes, indique tes zones et laisse Growi analyser l'exposition au soleil, les micro-climats et les besoins en eau — pour que chaque coin de ton jardin reçoive exactement ce qu'il lui faut."
      points={points}
      visual={<GardenImagePlaceholder variant="cartographie" />}
      reverse={false}
      aria-label="Fonctionnalité cartographie"
    />
  )
}
```

- [ ] **Step 2 : Créer SectionAssistant.tsx**

```tsx
// app/fonctionnalites/components/SectionAssistant.tsx

import { Brain, CloudSun, Bell, Sparkles } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Brain,    label: 'Conseils adaptés à chaque plante et chaque saison' },
  { icon: CloudSun, label: 'Rappels météo : gel, canicule, pluie abondante' },
  { icon: Bell,     label: 'Notifications au bon moment — pas en excès' },
  { icon: Sparkles, label: "Plan d'entretien hebdomadaire généré automatiquement" },
]

export function SectionAssistant() {
  return (
    <SectionFeature
      id="assistant"
      bg="sand"
      eyebrow="Assistant IA"
      title="Ton assistant jardin qui sait quand agir"
      description="Plus besoin de te souvenir de tout. Growi analyse la météo de ton code postal, le type de substrat et le stade de tes plantes pour te suggérer exactement ce qu'il faut faire — et quand le faire."
      points={points}
      visual={<GardenImagePlaceholder variant="assistant" />}
      reverse={true}
      aria-label="Fonctionnalité assistant IA"
    />
  )
}
```

- [ ] **Step 3 : Créer SectionDiagnostic.tsx**

```tsx
// app/fonctionnalites/components/SectionDiagnostic.tsx

import { Camera, ScanLine, Stethoscope, MessageCircle } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Camera,        label: 'Prends une photo — le diagnostic arrive en quelques secondes' },
  { icon: ScanLine,      label: 'Détection maladies, carences et nuisibles (top 200 pathologies)' },
  { icon: Stethoscope,   label: 'Traitement recommandé adapté à ton jardin' },
  { icon: MessageCircle, label: 'Télé-conseil avec un expert horticole si besoin' },
]

export function SectionDiagnostic() {
  return (
    <SectionFeature
      id="diagnostic"
      bg="white"
      eyebrow="Diagnostic IA"
      title="Identifie et soigne tes plantes en un clic"
      description="Une feuille jaunit ? Une tache bizarre apparaît ? Pointe ta caméra et Growi identifie le problème, te propose un traitement naturel adapté et, si la situation est complexe, te connecte à un expert en temps réel."
      points={points}
      visual={<GardenImagePlaceholder variant="diagnostic" />}
      reverse={false}
      aria-label="Fonctionnalité diagnostic IA"
    />
  )
}
```

- [ ] **Step 4 : Créer SectionCalendrier.tsx**

```tsx
// app/fonctionnalites/components/SectionCalendrier.tsx

import { CalendarDays, Sprout, Scissors, CloudRain } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: CalendarDays, label: 'Calendrier potager adapté à ta zone climatique' },
  { icon: Sprout,       label: 'Dates de semis et repiquage optimisées par plante' },
  { icon: Scissors,     label: 'Rappels taille, division, récolte au bon moment' },
  { icon: CloudRain,    label: 'Ajustements automatiques en cas de météo atypique' },
]

export function SectionCalendrier() {
  return (
    <SectionFeature
      id="calendrier"
      bg="sand"
      eyebrow="Calendrier"
      title="Ne rate plus jamais le bon moment pour semer"
      description="Growi construit ton planning annuel selon ta région, tes légumes et tes fleurs préférés. Chaque semaine, une liste de tâches courtes t'attend — taillée pour ton jardin, pas pour un jardin générique."
      points={points}
      visual={<GardenImagePlaceholder variant="calendrier" />}
      reverse={true}
      aria-label="Fonctionnalité calendrier potager"
    />
  )
}
```

- [ ] **Step 5 : Créer SectionMarketplace.tsx**

```tsx
// app/fonctionnalites/components/SectionMarketplace.tsx

import { ShoppingBag, Star, Wrench, Users } from 'lucide-react'
import { SectionFeature } from './SectionFeature'
import { GardenImagePlaceholder } from './GardenImagePlaceholder'

const points = [
  { icon: Wrench,      label: 'Élagage, arrosage enterré, création de massifs' },
  { icon: Star,        label: 'Professionnels notés par ta communauté locale' },
  { icon: ShoppingBag, label: 'Produits recommandés au bon moment, en bonne quantité' },
  { icon: Users,       label: 'Échange de graines et récoltes entre voisins' },
]

export function SectionMarketplace() {
  return (
    <SectionFeature
      id="marketplace"
      bg="white"
      eyebrow="Marketplace"
      title="Trouve les bons pros et les bons produits, sans chercher"
      description="Quand un chantier dépasse tes capacités ou que tu cherches du terreau de qualité, Growi te connecte aux bons interlocuteurs — pros du jardin locaux, boutiques partenaires ou voisins prêts à partager leurs récoltes."
      points={points}
      visual={<GardenImagePlaceholder variant="marketplace" />}
      reverse={false}
      aria-label="Fonctionnalité marketplace"
    />
  )
}
```

- [ ] **Step 6 : Commit**

```bash
git add app/fonctionnalites/components/SectionCartographie.tsx \
        app/fonctionnalites/components/SectionAssistant.tsx \
        app/fonctionnalites/components/SectionDiagnostic.tsx \
        app/fonctionnalites/components/SectionCalendrier.tsx \
        app/fonctionnalites/components/SectionMarketplace.tsx
git commit -m "feat(fonctionnalites): add 5 feature sections (cartographie→marketplace)"
```

---

## Task 6 : SectionPremium — tableau comparatif

**Files:**
- Create: `app/fonctionnalites/components/SectionPremium.tsx`

Fond `bg-forest`, texte blanc. Tableau comparatif 3 colonnes (Free / Premium / Pro Jardin) avec `<table>` HTML sémantique + Tailwind. `'use client'` pour Framer Motion.

- [ ] **Step 1 : Créer le composant**

```tsx
// app/fonctionnalites/components/SectionPremium.tsx
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
  { label: 'Identification photo plantes',         free: true,        premium: true,         pro: true },
  { label: 'Rappels arrosage & entretien',          free: true,        premium: true,         pro: true },
  { label: 'Calendrier potager',                    free: 'Basique',   premium: 'Complet',    pro: 'Complet' },
  { label: 'Diagnostic maladies/nuisibles',         free: '3/mois',    premium: 'Illimité',   pro: 'Illimité' },
  { label: 'Météo pro (72h précise)',                free: false,       premium: true,         pro: true },
  { label: 'Multi-jardins',                         free: '1 jardin',  premium: '5 jardins',  pro: 'Illimité' },
  { label: 'Export PDF rapport',                    free: false,       premium: true,         pro: true },
  { label: 'Télé-conseil expert',                   free: false,       premium: '1 session',  pro: 'Illimité' },
  { label: 'Accès marketplace services',            free: true,        premium: true,         pro: true },
  { label: 'Recommandations produits intelligentes',free: false,       premium: true,         pro: true },
]

const plans = [
  { key: 'free',    label: 'Gratuit',     price: '0 €',    period: 'pour toujours', cta: 'Commence maintenant', href: '/tarifs', highlight: false },
  { key: 'premium', label: 'Premium',     price: '4,99 €', period: 'par mois',      cta: 'Essaie 14 jours',     href: '/tarifs', highlight: true },
  { key: 'pro',     label: 'Pro Jardin',  price: '9,99 €', period: 'par mois',      cta: 'Démarrer Pro',        href: '/tarifs', highlight: false },
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
        {/* Header */}
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

        {/* Table */}
        <motion.div
          className="w-full overflow-x-auto"
          variants={shouldReduceMotion ? undefined : fadeUp}
        >
          <table className="w-full min-w-[600px] border-collapse" role="table">
            <caption className="sr-only">Comparatif des offres Growi : Gratuit, Premium et Pro Jardin</caption>

            {/* Plan headers */}
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

            {/* Feature rows */}
            <tbody>
              {features.map((feature, i) => (
                <tr
                  key={feature.label}
                  className={i % 2 === 0 ? 'bg-white/5' : ''}
                >
                  <td className="font-raleway text-white/80 text-sm py-3.5 pr-4 rounded-l-lg pl-3">
                    {feature.label}
                  </td>
                  <td className="text-center py-3.5 px-4">
                    <Cell value={feature.free} />
                  </td>
                  <td className="text-center py-3.5 px-4 bg-lime/10 rounded-none">
                    <Cell value={feature.premium} />
                  </td>
                  <td className="text-center py-3.5 px-4 rounded-r-lg">
                    <Cell value={feature.pro} />
                  </td>
                </tr>
              ))}
            </tbody>

            {/* CTA row */}
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
```

- [ ] **Step 2 : Commit**

```bash
git add app/fonctionnalites/components/SectionPremium.tsx
git commit -m "feat(fonctionnalites): add SectionPremium with accessible comparison table"
```

---

## Task 7 : CTABottom

**Files:**
- Create: `app/fonctionnalites/components/CTABottom.tsx`

Server Component, gradient `from-lime to-forest`, 2 CTAs.

- [ ] **Step 1 : Créer le composant**

```tsx
// app/fonctionnalites/components/CTABottom.tsx

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function CTABottom() {
  return (
    <section
      aria-label="Appel à l'action final"
      className="bg-gradient-to-r from-lime to-forest py-20 md:py-28"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-8 text-center">

        <h2 className="font-poppins font-bold text-forest text-3xl md:text-4xl max-w-2xl leading-tight">
          Prêt à te (re)connecter à ton jardin ?
        </h2>

        <p className="font-raleway text-forest/80 text-xl max-w-xl leading-relaxed">
          Rejoins les +12 000 jardiniers qui utilisent Growi chaque semaine.
          Commence gratuitement, sans carte bancaire.
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <Button variant="forest" size="lg" asChild>
            <Link href="/tarifs">Essaie gratuitement</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            asChild
            className="border-forest/40 text-forest hover:bg-forest/10"
          >
            <Link href="/tarifs">Voir les tarifs</Link>
          </Button>
        </div>

        <p className="font-raleway text-sm text-forest/60">
          14 jours d'essai Premium offerts · Sans engagement · Résiliation en 1 clic
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2 : Commit**

```bash
git add app/fonctionnalites/components/CTABottom.tsx
git commit -m "feat(fonctionnalites): add CTABottom gradient section"
```

---

## Task 8 : Assembler `app/fonctionnalites/page.tsx`

**Files:**
- Create: `app/fonctionnalites/page.tsx`

Page **Server Component**. Le scroll smooth est activé via `style={{ scrollBehavior: 'smooth' }}` sur la balise `<main>` — alternative : ajouter `html { scroll-behavior: smooth; }` dans `globals.css` (voir note ci-dessous).

**Note sur scroll smooth :** La méthode recommandée pour Next.js App Router est d'ajouter `scroll-behavior: smooth` au sélecteur `html` dans `globals.css`. Cela est plus fiable que le style inline et évite les problèmes de hydration. Modifier `globals.css` est la bonne approche.

- [ ] **Step 1 : Ajouter scroll-behavior smooth dans globals.css**

Fichier : `app/globals.css` — ajouter dans le bloc `@layer base` existant, après `body { ... }` :

```css
/* Smooth scroll for anchor links */
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

- [ ] **Step 2 : Créer page.tsx**

```tsx
// app/fonctionnalites/page.tsx

import type { Metadata } from 'next'
import { HeroFonctionnalites }  from './components/HeroFonctionnalites'
import { SectionCartographie }  from './components/SectionCartographie'
import { SectionAssistant }     from './components/SectionAssistant'
import { SectionDiagnostic }    from './components/SectionDiagnostic'
import { SectionCalendrier }    from './components/SectionCalendrier'
import { SectionMarketplace }   from './components/SectionMarketplace'
import { SectionPremium }       from './components/SectionPremium'
import { CTABottom }            from './components/CTABottom'

export const metadata: Metadata = {
  title: 'Fonctionnalités — Cartographie, Assistant IA, Diagnostic, Calendrier',
  description:
    "Découvre tout ce que Growi fait pour toi : carte de ton jardin, assistant météo, diagnostic IA, calendrier potager et marketplace de services.",
  openGraph: {
    title: 'Fonctionnalités Growi — Tout pour bien jardiner',
    description:
      "Cartographie, IA, calendrier potager, marketplace : explore toutes les fonctionnalités de Growi.",
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
      <SectionMarketplace />
      <SectionPremium />
      <CTABottom />
    </main>
  )
}
```

- [ ] **Step 3 : Commit**

```bash
git add app/fonctionnalites/page.tsx app/globals.css
git commit -m "feat(fonctionnalites): assemble /fonctionnalites page (8 sections)"
```

---

## Task 9 : Vérification build TypeScript et responsive

**Files:** aucun nouveau fichier

- [ ] **Step 1 : Build TypeScript**

```bash
cd /Users/dancohen/Documents/Travail/IA/Growi/growi-2/growi-frontend
npm run build
```

Expected : `✓ Compiled successfully` sans erreur TypeScript ni ESLint. Si des erreurs apparaissent :
- `Property 'X' does not exist` → vérifier les interfaces dans `SectionFeature.tsx`
- `Module not found` → vérifier les chemins d'import dans `page.tsx`
- `'use client'` boundary error → vérifier que les composants Framer Motion ont bien `'use client'`

- [ ] **Step 2 : Vérifier le rendu visuel en dev**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/fonctionnalites` et vérifier :
- [ ] Hero visible avec 6 liens d'ancre
- [ ] Clic sur "Cartographie" → scroll vers `#cartographie` (smooth)
- [ ] Alternance texte/visuel gauche-droite sur desktop (≥768px)
- [ ] Sur mobile (320px) : colonnes empilées, texte avant visuel
- [ ] Section `#premium` fond forest avec tableau
- [ ] CTABottom gradient lime→forest

- [ ] **Step 3 : Vérifier prefers-reduced-motion**

Dans DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Vérifier :
- Animations Framer Motion désactivées (pas de fadeUp/scaleIn)
- `scroll-behavior: auto` (liens d'ancre sautent directement)
- Badges `animate-float` et `animate-pulse-soft` désactivés (déjà géré dans `globals.css`)

- [ ] **Step 4 : Commit final**

```bash
git add -A
git commit -m "feat(fonctionnalites): validate build and a11y — page /fonctionnalites complete"
```

---

## Checklist de validation finale

| Critère | Vérifié par |
|---------|-------------|
| Tutoiement cohérent (tous les textes) | Relecture manuelle de chaque composant |
| Alternance texte/visuel L-R sur desktop | DevTools 1280px |
| 8 blocs présents | Compter dans `page.tsx` |
| Tableau comparatif accessible | `<table>` sémantique + `<caption>` sr-only + `aria-label` sur cellules Check/X |
| Liens d'ancre smooth scroll fonctionnels | Test manuel dans navigateur |
| Placeholders avec prompts IA commentés | Lire `GardenImagePlaceholder.tsx` |
| `npm run build` sans erreur TypeScript | `npm run build` en CI |
| Responsive 320px → 1280px+ | DevTools responsive mode |
| `prefers-reduced-motion` respecté | DevTools Rendering |
| Aucune balise `<img>` native | `grep -r "<img" app/fonctionnalites/` → 0 résultats |

---

## 4. Zones impactées

- **Frontend — nouvelle route** : `app/fonctionnalites/` (route et composants scoped)
- **CSS global** : `app/globals.css` (ajout `scroll-behavior: smooth` + media query reduced-motion)
- **Aucun impact backend** : page 100% statique, pas d'API calls
- **Aucun impact sur les autres pages** : les nouveaux composants sont scoped sous `app/fonctionnalites/components/`

## 5. Fichiers à créer/modifier

**Créer :**
```
app/fonctionnalites/page.tsx
app/fonctionnalites/components/HeroFonctionnalites.tsx
app/fonctionnalites/components/GardenImagePlaceholder.tsx
app/fonctionnalites/components/SectionFeature.tsx
app/fonctionnalites/components/SectionCartographie.tsx
app/fonctionnalites/components/SectionAssistant.tsx
app/fonctionnalites/components/SectionDiagnostic.tsx
app/fonctionnalites/components/SectionCalendrier.tsx
app/fonctionnalites/components/SectionMarketplace.tsx
app/fonctionnalites/components/SectionPremium.tsx
app/fonctionnalites/components/CTABottom.tsx
public/images/fonctionnalites/.gitkeep
```

**Modifier :**
```
app/globals.css   ← ajout scroll-behavior: smooth
```

## 6. Risques

| Risque | Probabilité | Mitigation |
|--------|------------|-----------|
| `'use client'` boundary error : Server Component important un Client Component sans marquage | Moyen | `SectionFeature`, `SectionPremium`, `FeaturesGrid` ont `'use client'` ; les sections qui les importent restent Server Components (pas de hook) — ça fonctionne car Next.js permet d'importer des Client Components depuis des Server Components |
| `scroll-behavior: smooth` ignoré sur iOS Safari ancienne version | Faible | Dégradation gracieuse acceptable — le scroll fonctionne, juste sans animation |
| Tableau Premium overflow sur mobile 320px | Moyen | `overflow-x-auto` sur le wrapper du tableau + `min-w-[600px]` sur `<table>` gèrent ce cas |
| Icones Lucide non installées | Faible | Toutes les icones utilisées (`Map`, `Layers`, `Brain`, `Camera`, etc.) font partie du package `lucide-react` déjà installé — vérifier avec `grep "lucide-react" package.json` |
| Tutoiement incohérent dans les textes | Moyen | Relecture systématique dans la checklist finale — tous les textes du plan sont déjà au tutoiement |

## 7. Ordre suggéré

1. Task 1 — Dossier public (1 min)
2. Task 2 — GardenImagePlaceholder (fondation visuelle réutilisée partout)
3. Task 3 — SectionFeature (composant générique dont dépendent 5 sections)
4. Task 4 — HeroFonctionnalites (premier bloc visible)
5. Task 5 — 5 sections feature (en parallèle si multi-agent)
6. Task 6 — SectionPremium (la plus complexe — tableau)
7. Task 7 — CTABottom (simple)
8. Task 8 — Assemblage page.tsx + globals.css
9. Task 9 — Build + validation

---

## Agents recommandés pour l'exécution

- **@front-builder** : exécution de toutes les tâches (Task 1→9) — c'est une page frontend pure
- **@reviewer** : relecture post-build pour vérifier tutoiement, accessibilité du tableau et cohérence visuelle avec le reste du site
