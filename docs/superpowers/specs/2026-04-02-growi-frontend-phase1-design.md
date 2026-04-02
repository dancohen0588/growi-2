# Growi Frontend — Phase 1 Design Spec

**Date :** 2026-04-02  
**Scope :** Phase 1 — Design system + Homepage + Layout partagé (Header/Footer)  
**Stack :** Next.js 14 App Router · TypeScript strict · Tailwind CSS · shadcn/ui · Framer Motion · next/font · next/image  
**Approche :** Foundation d'abord (A) — scaffold → tokens → composants → homepage

---

## 1. Périmètre Phase 1

Ce document couvre uniquement la Phase 1. Les pages secondaires (fonctionnalités, tarifs, pro, contact, à propos, blog) sont planifiées en Phase 2.

**Livrables Phase 1 :**
- Projet Next.js initialisé avec toutes les dépendances
- Design system complet (tokens CSS, Tailwind, composants partagés)
- Layout partagé : Header sticky + Footer
- Homepage complète : 8 sections
- `npm run build` sans erreur ni warning TypeScript

---

## 2. Architecture & structure de fichiers

### Ordre de construction

1. Scaffold `create-next-app` + installation dépendances
2. `globals.css` — tokens CSS Growi
3. `tailwind.config.ts` — couleurs, fonts, shadows, keyframes
4. `lib/utils.ts` + `lib/animations.ts`
5. Composants partagés : `<Button>`, `<SectionWrapper>`, `<AppMockup>`
6. `components/layout/Header.tsx` + `components/layout/Footer.tsx`
7. `app/layout.tsx` — fonts next/font, metadata globale, import Header + Footer
8. 8 sections homepage → `app/page.tsx`

### Structure finale

```
growi-frontend/
├── app/
│   ├── layout.tsx               # fonts next/font, metadata, Header/Footer
│   └── page.tsx                 # assemble les 8 sections
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Footer.tsx
│   ├── home/
│   │   ├── HeroSection.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── AppPreview.tsx
│   │   ├── FeaturesGrid.tsx
│   │   ├── Testimonials.tsx
│   │   ├── ProSection.tsx
│   │   └── FinalCTA.tsx
│   └── ui/
│       ├── button.tsx           # shadcn étendu avec variantes Growi
│       ├── section-wrapper.tsx  # wrapper réutilisable avec animation
│       ├── app-mockup.tsx       # frame smartphone CSS riche
│       └── plant-badge.tsx      # badge Growi custom
├── lib/
│   ├── utils.ts                 # cn()
│   └── animations.ts            # variants Framer Motion
├── public/images/               # vide Phase 1
├── styles/globals.css
├── tailwind.config.ts
└── next.config.ts
```

---

## 3. Design system

### 3.1 Tokens CSS (`globals.css`)

```css
@layer base {
  :root {
    --color-lime:   179 83% 67%;   /* #B4DD7F — CTA principal */
    --color-forest: 139 51% 23%;   /* #1E5631 — titres, texte fort */
    --color-sand:   52 50% 95%;    /* #F9F7E8 — fond principal */
    --color-sun:    43 91% 62%;    /* #F6C445 — badges, highlights */

    /* shadcn tokens */
    --background:             52 50% 95%;
    --foreground:             139 51% 23%;
    --primary:                179 83% 67%;
    --primary-foreground:     139 51% 23%;
    --secondary:              52 50% 90%;
    --secondary-foreground:   139 51% 23%;
    --muted:                  52 30% 88%;
    --muted-foreground:       139 20% 40%;
    --accent:                 43 91% 62%;
    --accent-foreground:      139 51% 23%;
    --destructive:            0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border:                 139 20% 80%;
    --input:                  139 20% 80%;
    --ring:                   179 83% 67%;
    --radius:                 0.75rem;

    --space-section:   5rem;
    --space-container: 2rem;
  }
}
```

### 3.2 Tailwind config

```typescript
theme: {
  extend: {
    colors: {
      lime:   { DEFAULT: '#B4DD7F', hover: '#a2cf6b' },
      forest: { DEFAULT: '#1E5631', light: '#2d7a47' },
      sand:   { DEFAULT: '#F9F7E8', dark: '#ede9cc' },
      sun:    { DEFAULT: '#F6C445', hover: '#e4b030' },
    },
    fontFamily: {
      poppins: ['var(--font-poppins)', 'sans-serif'],
      raleway: ['var(--font-raleway)', 'sans-serif'],
    },
    borderRadius: {
      lg: 'var(--radius)',
      xl: 'calc(var(--radius) + 4px)',
      '2xl': 'calc(var(--radius) + 8px)',
      '3xl': 'calc(var(--radius) + 16px)',
    },
    boxShadow: {
      card:       '0 2px 12px rgba(30, 86, 49, 0.08)',
      'card-hover':'0 8px 24px rgba(30, 86, 49, 0.14)',
      cta:        '0 4px 20px rgba(180, 221, 127, 0.5)',
    },
    keyframes: {
      float: {
        '0%, 100%': { transform: 'translateY(0px)' },
        '50%':      { transform: 'translateY(-12px)' },
      },
    },
    animation: {
      float:        'float 6s ease-in-out infinite',
      'pulse-soft': 'pulse 3s ease-in-out infinite',
    },
  },
},
```

### 3.3 `<Button>` — variantes Growi

Extension du composant shadcn via `class-variance-authority` :

| Variante  | Apparence |
|-----------|-----------|
| `primary` | `bg-lime text-forest shadow-cta hover:bg-lime-hover active:scale-[0.98]` |
| `forest`  | `bg-forest text-white hover:bg-forest-light` |
| `outline` | `border-2 border-forest text-forest hover:bg-forest/10` |
| `ghost`   | `text-forest hover:bg-forest/5` |

Tailles : `sm` h-9 px-4 · `default` h-11 px-6 · `lg` h-14 px-8 text-lg  
Focus : `ring-2 ring-lime ring-offset-2`  
Touch target minimum : 44×44px CSS  
État loading : spinner Lucide + `disabled` + `aria-busy="true"`

### 3.4 `<SectionWrapper>`

Props : `id?`, `className?`, `children`, `variant: 'sand' | 'white' | 'forest' | 'gradient'`

- Padding : `py-20 md:py-28`
- Container : `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
- Animation : `motion.div` Framer Motion, variant `fadeUp`, `whileInView`, `once: true`, `margin: '-100px'`
- Enfants en stagger : `staggerContainer` avec `delayChildren: 0.1, staggerChildren: 0.12`
- Désactivé si `useReducedMotion()` retourne `true`

### 3.5 `<AppMockup>` — fidelité riche (option C validée)

Frame smartphone 100% CSS :
- Conteneur : `aspect-[9/19] rounded-[2.5rem] border-4 border-forest/20 shadow-2xl`
- Animation : `animate-float`
- Désactivée si `prefers-reduced-motion`

Contenu du dashboard (statique) :
- Header dégradé `linear-gradient(135deg, #1E5631, #2d7a47)` avec "🌱 Mes plantes" + bouton `+`
- Card "Ficus Lyrata" : avatar emoji, barre d'hydratation lime 65%, étiquette exposition
- Badge météo `bg-sun/20` : ☀️ 22°C
- Alerte `bg-lime/15` : 🔔 "Arroser dans 2h · 200ml"
- Card "Diagnostic IA" avec badge "NEW" lime
- Bottom nav : 4 icônes emoji (Accueil actif, Recherche, Store, Profil)

### 3.6 `lib/animations.ts`

```typescript
export const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}
export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
}
export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}
export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
}
```

Règle globale : durée max 0.8s, `once: true` sur tous les `whileInView`.

---

## 4. Layout partagé

### 4.1 Header

- `'use client'` — utilise `useEffect` + event `scroll`
- Sticky (`position: sticky top-0 z-50`)
- Fond par défaut : transparent. Au scroll > 50px : `backdrop-blur-md bg-sand/80 shadow-sm` (via `useEffect` + event `scroll`)
- Logo : "Growi 🌱" Poppins 700 `text-forest`, lien vers `/`
- Navigation desktop : 5 liens (Fonctionnalités, Premium, Blog, Pro, Contact) `text-forest/70 hover:text-forest`
- CTA sticky : `<Button variant="primary" size="sm">Télécharger l'app</Button>`
- Mobile : burger icon Lucide `<Menu>`, ouvre `<Sheet>` shadcn avec nav verticale et même CTA

### 4.2 Footer

- 4 colonnes desktop → 2 tablet → 1 mobile (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- Col 1 : Logo + slogan + icônes sociales Lucide (Instagram, Linkedin, Youtube)
- Col 2 : Produit (Fonctionnalités / Premium / App / Tarifs)
- Col 3 : Entreprise (À propos / Blog / Pro / Contact)
- Col 4 : Légal (Mentions légales / RGPD / CGU)
- Bas : `<Separator>` shadcn + badge "Greentech France 🌿" + "Made with 💚 in France" + "© 2026 Growi"
- Fond : `bg-forest text-white` (liens `text-white/70 hover:text-white`)

---

## 5. Homepage — 8 sections

### Section 1 — Hero

**Fond :** `bg-gradient-to-br from-sand via-sand to-lime/30`  
**Layout desktop :** grille 2 colonnes (`grid-cols-2`), stack sur mobile  

**Colonne gauche :**
- `<h1>` Poppins 700 3.5rem desktop / 2.5rem mobile, `text-forest` : *"Ton jardin, ta croissance."*
- Sous-titre Raleway 400 1.25rem `text-forest/70 max-w-lg`
- 2 CTAs côte à côte : `[Essayer gratuitement]` primary lg → `/tarifs` · `[Voir les fonctionnalités]` outline lg → `/fonctionnalites`
- 3 badges feature sous les CTAs (layout C) : `🌧️ Météo connectée` (bg-white), `✅ Rappel arrosage` (bg-lime/20), `📷 Diagnostic IA` (bg-sun/20)
- Social proof : "⭐⭐⭐⭐⭐ +12 000 jardiniers nous font confiance" `text-sm text-forest/60`

**Colonne droite :**
- `<AppMockup>` centré, seul, animation float

### Section 2 — Comment ça marche

**Variant :** `white`  
**Layout :** 3 colonnes avec stagger +0.15s

| # | Icône | Titre | Description |
|---|-------|-------|-------------|
| 01 | `<Sprout>` | Identifie tes plantes | Prends une photo ou choisis dans la base de données. |
| 02 | `<Bell>` | Reçois les bons rappels | Arrosage, rempotage, taille, selon ton climat. |
| 03 | `<Sun>` | Fais-les prospérer | Des conseils adaptés à la météo et au moment de l'année. |

Numérotation : cercle `w-12 h-12 rounded-full bg-lime text-forest font-bold`  
CTA bas : `<Button variant="outline">Découvrir toutes les fonctionnalités</Button>`

### Section 3 — Aperçu app

**Variant :** `forest`  
Mockup central + 4 cards blanches (`position: absolute`, 2 gauche / 2 droite) :
- 🌡️ Santé de tes plantes (barre progression CSS)
- ☀️ Météo du jour (température fictive)
- 🔔 Alertes intelligentes (badge rouge)
- 📅 Calendrier jardin (mini calendrier stylisé)

Baseline : `text-white` Poppins centré en bas de section.

### Section 4 — Fonctionnalités phares

**Variant :** `sand`  
**Grid :** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`  
Cards shadcn `rounded-2xl border-0 shadow-card hover:shadow-card-hover transition-shadow`  
Icône dans `div w-12 h-12 rounded-xl bg-lime/20`

| Icône | Titre | Description |
|-------|-------|-------------|
| `<Brain>` | Assistant intelligent | L'app adapte les conseils à ta météo locale. |
| `<Camera>` | Diagnostic photo IA | Identifie maladies et carences instantanément. |
| `<CalendarDays>` | Calendrier du jardin | Planifie semis, tailles et floraisons. |
| `<ShoppingBag>` | Store contextuel | Trouve ce qu'il te faut au bon moment. |
| `<Users>` | Communauté locale | Partage tes réussites et tes plantes. |
| `<Star>` | Version Premium | Diagnostic illimité + météo pro + multi-jardins. |

CTA centré : `<Button variant="forest">Explorer toutes les fonctionnalités</Button>`

### Section 5 — Témoignages

**Variant :** `sand` (fond `sand-dark`)  
`'use client'` — `<Carousel>` shadcn/Embla, swipeable mobile

Cards :
- Avatar : initiales dans cercle `bg-lime text-forest` (pas d'image)
- Étoiles : 5× `<Star className="fill-sun text-sun w-4 h-4">`
- Citation : Raleway italic
- Nom + ville + type jardin : Poppins 600

3 témoignages :
1. *"Grâce à Growi, mes plantes d'intérieur sont enfin épanouies !"* — **Julie B.**, Lyon • 🌿
2. *"Plus besoin de me demander quand tailler mes rosiers."* — **Marc D.**, Bordeaux • 🌹
3. *"Le rappel météo m'a sauvé mon potager."* — **Pierre L.**, Nantes • 🍅

### Section 6 — Pro

**Variant :** `white`  
Layout 2 colonnes (texte gauche, mockup laptop droite)  
Checkpoints : `<Check className="text-lime">` + `border-l-4 border-lime pl-4`  
Badge : shadcn `bg-forest text-white` — "Pour les professionnels"  
Mockup laptop : frame CSS simple, écran KPIs fictifs (vert sapin + lime)  
CTA : `<Button variant="forest" size="lg">Découvrir Growi Pro</Button>` → `/pro`

### Section 7 — CTA Final

**Fond :** `bg-gradient-to-r from-lime to-forest`  
Texte centré `text-white`  
2 boutons store : `border-2 border-white text-white hover:bg-white/20 rounded-xl`  
Icônes SVG inline Apple + Play (pas de bibliothèque externe)

### Section 8 — Footer

Voir §4.2.

---

## 6. Accessibilité

| Règle | Implémentation |
|-------|---------------|
| 1 seul `<h1>` | HeroSection uniquement |
| Hiérarchie titres | h1 Hero → h2 sections → h3 cards |
| Landmarks | `<header>`, `<nav>`, `<main>`, sections avec `aria-label`, `<footer>` |
| Focus ring | `ring-2 ring-lime ring-offset-2` sur tous les éléments interactifs |
| Contraste | forest #1E5631 / sand #F9F7E8 = 9.8:1 ✓ |
| Images | `next/image` obligatoire, `alt=""` sur décoratifs |
| Icônes seules | `aria-hidden={true}` + texte visible adjacent |
| Touch targets | min 44×44px CSS |
| Zoom 200% | layout responsive testé |

---

## 7. Performance & contraintes

- `next/font` uniquement — jamais de `<link>` Google Fonts
- `next/image` obligatoire — jamais de `<img>` natif
- Pas d'images externes pour Phase 1 — tout en CSS/SVG/placeholders
- Pas d'appels API — données 100% statiques
- TypeScript strict — zéro `any`, types explicites sur toutes les props
- shadcn uniquement pour les composants UI de base
- `prefers-reduced-motion` : hook `useReducedMotion()` Framer Motion appliqué sur tous les composants animés

---

## 8. Critères de succès

- [ ] `npm run build` sans erreur ni warning TypeScript
- [ ] Zéro `console.error` dans le navigateur
- [ ] Layout lisible à 320px, 768px et 1280px+
- [ ] Header burger menu fonctionnel sur mobile
- [ ] Carousel testimonials swipeable sur mobile
- [ ] Focus ring visible sur tous les éléments interactifs
- [ ] Animation float désactivée si `prefers-reduced-motion`
- [ ] Palette Growi appliquée via CSS variables shadcn
- [ ] Typographie Poppins/Raleway via `next/font`

---

## 9. Hors périmètre Phase 1

- Pages secondaires : `/fonctionnalites`, `/tarifs`, `/pro`, `/contact`, `/a-propos`, `/blog`
- Formulaires react-hook-form + zod
- Stripe Connect, IoT, API météo
- Tests automatisés
