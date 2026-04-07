# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

```
growi-2/
├── growi-frontend/     # Next.js 14 marketing + auth frontend (App Router)
└── docs/               # Specs and implementation plans
```

All frontend work lives in `growi-frontend/`. There is no backend yet.

## Commands

All commands run from `growi-frontend/`:

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check
```

No test suite is configured yet.

## Architecture

### Next.js App Router layout

Two route groups share the root `app/layout.tsx` (SessionProvider, Google Fonts):

- `(marketing)/` — public pages with `Header` + `Footer` via its own layout
- `(auth)/` — login/register pages, centered full-screen, robots `noindex`

### Design system

Growi's palette is defined in `tailwind.config.ts` and mapped to shadcn CSS variables in `globals.css`:

| Token | Hex | Usage |
|-------|-----|-------|
| `lime` | `#B4DD7F` | Primary CTA, highlights |
| `forest` | `#1E5631` | Text, dark sections |
| `sand` | `#F9F7E8` | Default background |
| `sun` | `#F6C445` | Accent/badge |

Typography: `font-poppins` for headings, `font-raleway` for body (both via CSS variables).

Custom shadows: `shadow-card`, `shadow-card-hover`, `shadow-cta`.

### Component conventions

- **`SectionWrapper`** (`components/ui/section-wrapper.tsx`) — use for every marketing section. Handles `py-20 md:py-28`, `max-w-7xl` container, and Framer Motion scroll-triggered animations. Accepts `variant` prop: `sand | white | forest | gradient`.
- **Animation primitives** (`lib/animations.ts`) — `fadeUp`, `fadeIn`, `scaleIn`, `staggerContainer` Framer Motion variants. All components must respect `useReducedMotion()`.
- **UI primitives** (`components/ui/`) — shadcn-based: `Button`, `Badge`, `Card`, `Carousel`, `Sheet`, `Separator`, `AppMockup`.

### Auth

`auth.ts` configures NextAuth v5 (beta) with a Credentials provider backed by `lib/mock-users.ts`. JWT session strategy. The session type is augmented to include `user.firstName` and `user.id`. Middleware protects `/dashboard/**` only.

To add OAuth providers, see the `TODO` comment in `auth.ts`.

### Routing

| Route | Description |
|-------|-------------|
| `/` | Homepage (7 marketing sections) |
| `/fonctionnalites` | Features page |
| `/login` | Auth sign-in (custom page) |
| `/register` | Registration |
| `/dashboard/**` | Protected (middleware) |
