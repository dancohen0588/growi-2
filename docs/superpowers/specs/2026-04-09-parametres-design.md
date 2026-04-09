# Design Spec — Page Paramètres (`/dashboard/parametres`)

**Date:** 2026-04-09  
**Stack:** Next.js 14 App Router · shadcn/ui · react-hook-form · zod · Framer Motion · localStorage  
**Scope:** 100% frontend, données mockées / localStorage, aucune API réelle

---

## 1. Périmètre

Nouvelle page protégée `/dashboard/parametres` avec deux sections :

| Section | Onglet | Description |
|---------|--------|-------------|
| Informations personnelles | "Mon profil" | Modifier prénom, nom, email, adresse, avatar (initiales), type de jardin + changement de mot de passe |
| Configuration des alertes | "Mes alertes" | Activer/désactiver et paramétrer 10 types d'alertes + canal/fréquence de livraison |

**Hors scope :** upload de photo, API réelle, OAuth, SSO.

---

## 2. Décisions d'architecture

### 2.1 Navigation

- `DashboardNav` : ajouter `{ href: '/dashboard/parametres', label: 'Paramètres', icon: Settings }` **en dernière position** avant "Se déconnecter" (actuellement il n'y a pas de bouton Se déconnecter dans la nav — l'ajouter comme item visuel ou laisser uniquement dans UserMenu).
- "Mon compte" (`/dashboard/compte`) **reste inchangé**.
- `UserMenu` dans le header : lien "Mon compte" **reste sur `/dashboard/compte`** (pas modifié).

### 2.2 Adresse — harmonisation en plain string

**Décision :** migrer de `UserAddress` (objet structuré) vers une chaîne plain text dans `MockUser` ET dans `UserProfile` localStorage.

Impact :
- `lib/mock-users.ts` : `address?: UserAddress` → `address?: string`
- `app/dashboard/meteo/page.tsx` : passe l'adresse string au client
- `WeatherPageClient` : mode "compte" utilise l'adresse string pour géocoder (via l'API Nominatim déjà utilisée par `AddressSearchBar`)
- La seed user `dan0588` : `address` passe à `"1 Rue de Rivoli, Paris 75001, France"`

### 2.3 Persistance — `localStorage`

Clé : `growi_user_profile`. Structure : `UserProfile` (voir §3).  
Event dispatché à chaque écriture : `window.dispatchEvent(new CustomEvent('growi:profile-updated', { detail: updated }))`.  
`// TODO: Remplacer par PATCH /api/user/profile`

### 2.4 Initialisation du profil

Au premier chargement de la page Paramètres (localStorage vide), le hook `useUserProfile` initialise le profil depuis la session NextAuth (firstName, email) + `defaultAlertConfig`. L'utilisateur voit ses données pré-remplies, pas un état "vide".

---

## 3. Modèle de données

### Extensions `lib/mock-users.ts`

```typescript
export type NotificationChannel = 'push' | 'email' | 'both' | 'none'
export type AlertFrequency = 'immediate' | 'daily_digest' | 'weekly_digest'

export interface AlertConfig {
  // Météo
  frostAlert: boolean
  frostThreshold: number        // défaut: 2°C
  heatAlert: boolean
  rainAlert: boolean
  windAlert: boolean
  // Plantes & entretien
  wateringReminder: boolean
  wateringFrequencyDays: number // défaut: 2
  repottingReminder: boolean
  pruningReminder: boolean
  // Calendrier
  seedingAlerts: boolean
  harvestAlerts: boolean
  // Livraison
  channel: NotificationChannel
  frequency: AlertFrequency
  quietHoursEnabled: boolean
  quietHoursStart: string       // "HH:MM"
  quietHoursEnd: string         // "HH:MM"
}

export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  address?: string              // plain string — même champ que météo
  city?: string                 // ville déduite (affichage)
  avatarColor?: string          // ex: '#B4DD7F'
  gardenType?: 'potager' | 'ornement' | 'mixte' | 'interieur' | 'balcon'
  timezone?: string
  alertConfig: AlertConfig
}

export const defaultAlertConfig: AlertConfig = {
  frostAlert: true, frostThreshold: 2,
  heatAlert: true, rainAlert: false, windAlert: false,
  wateringReminder: true, wateringFrequencyDays: 2,
  repottingReminder: true, pruningReminder: false,
  seedingAlerts: true, harvestAlerts: true,
  channel: 'push', frequency: 'immediate',
  quietHoursEnabled: false, quietHoursStart: '22:00', quietHoursEnd: '07:00',
}
```

`MockUser.address` passe de `UserAddress` à `string | undefined`. Tous les imports de `UserAddress` sont supprimés ou adaptés.

---

## 4. Structure fichiers

```
app/dashboard/parametres/page.tsx

components/dashboard/parametres/
  ParametresLayout.tsx       — wrapper Tabs (sync hash URL)
  ProfilForm.tsx             — formulaire profil + section Sécurité
  AlertesForm.tsx            — toutes les sections d'alertes
  AvatarEditor.tsx           — initiales + 5 pastilles couleur
  AlertToggleCard.tsx        — card réutilisable toggle + expand

lib/schemas/
  profil-schema.ts           — zod schema profil
  alertes-schema.ts          — zod schema alertes (optionnel, principalement contrôlé par react-hook-form)

hooks/
  useUserProfile.ts          — lecture/écriture localStorage + event dispatch
```

---

## 5. Composants shadcn à installer

Manquants par rapport à ce qui est déjà installé :

```bash
npx shadcn@latest add switch slider radio-group dialog skeleton tooltip
```

`toast` → utiliser le shadcn `toast` déjà installé (pas sonner).

---

## 6. Page `/dashboard/parametres`

### Layout

```
[DashboardHeader]
[DashboardNav]           ← "Paramètres" ajouté en bas

<main class="max-w-3xl mx-auto px-4 py-8">
  <PageHeader>
    <h1>Paramètres</h1>
    <p>Gère ton profil et tes préférences de notifications.</p>
  </PageHeader>

  <Tabs defaultValue="profil" syncHash>
    <TabsTrigger value="profil">  <User/>  Mon profil  </TabsTrigger>
    <TabsTrigger value="alertes"> <Bell/>  Mes alertes </TabsTrigger>
    <TabsContent value="profil">  <ProfilForm/>  </TabsContent>
    <TabsContent value="alertes"> <AlertesForm/> </TabsContent>
  </Tabs>
</main>
```

Hash sync : au montage lire `window.location.hash`, sur changement d'onglet `router.replace('#profil')` ou `'#alertes'`.

---

## 7. Section Profil

### AvatarEditor

- Cercle w-20 h-20, fond `avatarColor`, initiales Poppins 700 text-forest
- 5 pastilles cliquables : `#B4DD7F`, `#F6C445`, `#1E5631`, `#93C5FD`, `#FCA5A5`
- `// TODO: Ajouter upload photo avec next/image`

### Champs (react-hook-form + zod)

| Champ | Input | Validation |
|-------|-------|-----------|
| Prénom | Input, autoComplete given-name | min 2 chars |
| Nom | Input, autoComplete family-name | min 2 chars |
| Email | Input type=email | email() |
| Adresse | Input, Tooltip "utilisée pour ta météo 🌤️" | optionnel |
| Type de jardin | Select | optionnel |

Options jardin : Potager 🍅 / Ornemental 🌸 / Mixte 🌿 / Intérieur 🪴 / Balcon 🌺

### États bouton submit

`idle` → `saving` (spinner + disabled) → `saved` (vert + Check + "Enregistré !" 2s) → `idle` | `error` (rouge + AlertTriangle)

### Toast succès

`"Tes informations ont bien été enregistrées 🌱"` (toast shadcn, variant default)

### Section Sécurité (sous un Separator)

Bouton "Changer mon mot de passe" → `<Dialog>` avec :
- Mot de passe actuel (toggle visibility)
- Nouveau mot de passe (toggle + indicateur de force : weak/medium/strong via regex)
- Confirmation
- Schéma zod : même règles que `registerSchema` (lib/auth-schemas.ts)
- `// TODO: Connecter à PATCH /api/user/password`

---

## 8. Section Alertes

### AlertToggleCard

```typescript
interface AlertToggleCardProps {
  icon: React.ReactNode
  title: string
  description: string
  enabled: boolean
  onToggle: (val: boolean) => void
  children?: React.ReactNode     // sous-paramètres conditionnels
  badge?: string
  badgeColor?: 'lime' | 'sun' | 'forest'
}
```

Style : `bg-white rounded-2xl shadow-card p-5`, `border-l-4 border-lime` si enabled sinon `border-l-4 border-muted`.  
Sous-paramètres : `<AnimatePresence>` + `motion.div` height 0→auto (duration 0.25s). Respecte `useReducedMotion()`.

### Sous-sections

**Alertes météo** — badge "Météo" bg-lime/20

| Alerte | Icône | Sous-param si activée |
|--------|-------|-----------------------|
| Risque de gel | Thermometer | Slider seuil -5→+5°C |
| Canicule | Sun | — |
| Pluie forte | CloudRain | — |
| Vent violent | Wind | — |

**Entretien & plantes** — badge "Plantes" bg-sun/20

| Alerte | Icône | Sous-param si activée |
|--------|-------|-----------------------|
| Rappels d'arrosage | Droplets | RadioGroup fréquence (1/2/3/7 jours) |
| Rempotage saisonnier | Flower2 | — |
| Rappels de taille | Scissors | — |

**Calendrier jardin** — badge "Calendrier" bg-forest/10

| Alerte | Icône |
|--------|-------|
| Périodes de semis | Sprout |
| Récoltes imminentes | Apple |

**Comment te contacter**

- Select canal : push / email / both / none  
  → Si `none` : banner `bg-sun/20` "Tu ne recevras aucune alerte. Ton jardin risque de souffrir sans toi ! 🌵"
- RadioGroup fréquence : immediate / daily_digest / weekly_digest
- Switch heures silencieuses → 2 inputs type="time" (De / À)

### Boutons d'action alertes

```
[Réinitialiser (ghost)] [Enregistrer mes alertes (primary)]
```

Réinitialiser → `<AlertDialog>` confirmation avant reset vers `defaultAlertConfig`.  
Toast succès : `"Tes préférences d'alertes ont été sauvegardées 🔔"`

---

## 9. Hook `useUserProfile`

- Lit `localStorage` key `growi_user_profile` au montage
- Si vide : initialise depuis session NextAuth (firstName, email) + `defaultAlertConfig`
- `updateProfile(Partial<UserProfile>)` : merge + write + dispatch `growi:profile-updated`
- `updateAlerts(Partial<AlertConfig>)` : merge alertConfig + write
- Expose `{ profile, isLoading, updateProfile, updateAlerts }`

---

## 10. Intégration météo

`WeatherPageClient` écoute `growi:profile-updated` pour rafraîchir l'adresse en mode "compte".  
`app/dashboard/meteo/page.tsx` passe `userAddress` comme string (plus d'objet `UserAddress`).  
Le composant `AddressSearchBar` (déjà existant avec Nominatim) est réutilisé pour la géocodification en mode compte quand l'adresse change.

---

## 11. Skeleton loaders

Affiché quand `isLoading === true` :
- Avatar : `Skeleton` w-20 h-20 rounded-full
- Champs : 3 × `Skeleton` h-10 rounded-lg
- Cards alertes : 5 × `Skeleton` h-16 rounded-2xl

---

## 12. Accessibilité

- Tous les champs ont un `<Label htmlFor>` associé
- Erreurs zod liées via `aria-describedby`
- Switch : `role="switch"` `aria-checked` `aria-label` explicite
- Slider gel : `aria-label="Seuil de gel"` `aria-valuemin` `aria-valuemax` `aria-valuenow` `aria-valuetext`
- Dialog mot de passe : focus trap, fermeture Escape, `aria-labelledby`
- `prefers-reduced-motion` : désactive AnimatePresence / motion.div

---

## 13. Ton & wording

Tutoiement systématique. Ton "coach jardin" — court, verbes d'action.

> ✅ "Tes informations ont bien été enregistrées 🌱"  
> ✅ "Tu recevras une alerte avant chaque risque de gel."  
> ❌ "Vos informations ont été mises à jour."

---

## 14. Checklist de livraison

- [ ] `app/dashboard/parametres/page.tsx` créé
- [ ] `DashboardNav` : entrée "Paramètres" + icône Settings ajoutée
- [ ] `MockUser.address` migré vers string, seed user adaptée
- [ ] `app/dashboard/meteo/page.tsx` adapté (address string)
- [ ] `WeatherPageClient` écoute `growi:profile-updated`
- [ ] `UserProfile` + `AlertConfig` + `defaultAlertConfig` dans `mock-users.ts`
- [ ] Hook `useUserProfile` opérationnel
- [ ] `AvatarEditor` fonctionnel (initiales + 5 couleurs)
- [ ] `ProfilForm` react-hook-form + zod + états bouton
- [ ] Dialog mot de passe avec indicateur de force
- [ ] `AlertToggleCard` avec animation expand/collapse
- [ ] 10 alertes configurables
- [ ] Slider gel + RadioGroup arrosage
- [ ] Select canal + banner "none"
- [ ] Heures silencieuses
- [ ] AlertDialog réinitialisation
- [ ] Skeleton loaders
- [ ] shadcn manquants installés (switch, slider, radio-group, dialog, skeleton, tooltip)
- [ ] `npm run build` sans erreurs TypeScript
- [ ] Responsive 320px → 1280px+
- [ ] WCAG 2.1 AA
