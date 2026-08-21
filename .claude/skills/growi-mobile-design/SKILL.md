---
name: growi-mobile-design
description: Règles de design pour tout écran ou composant de l'app mobile Growi (apps/mobile, Expo/React Native/NativeWind). À utiliser dès qu'on crée ou modifie un écran, un composant UI ou un style dans apps/mobile — garantit la cohérence avec le design system web, le respect des règles UX mobile (zones tactiles, safe areas, états) et du responsive.
---

# Growi Mobile — Design System & règles UX

S'applique à tout code UI dans `apps/mobile`. En cas de conflit avec une demande, signaler le conflit plutôt que d'ignorer silencieusement une règle.

## 1. Tokens (source de vérité : apps/web/tailwind.config.ts + globals.css)

### Couleurs (config NativeWind — reprendre ces valeurs exactes)

| Token | Valeur | Usage |
|---|---|---|
| `lime` | `#B4DD7F` (pressed `#a2cf6b`) | Couleur primaire : CTA, éléments actifs, focus |
| `forest` | `#1E5631` (light `#2d7a47`) | Texte principal, titres, boutons secondaires |
| `sand` | `#F9F7E8` (dark `#ede9cc`) | Fond d'écran par défaut |
| `sun` | `#F6C445` (pressed `#e4b030`) | Accent : badges, alertes positives, highlights |
| `destructive` | `hsl(0 84% 60%)` | Erreurs, suppressions |
| `muted-foreground` | `hsl(139 20% 40%)` | Textes secondaires |
| `border`/`input` | `hsl(139 20% 80%)` | Bordures, champs |
| `card` | `hsl(52 50% 97%)` | Fond des cartes |

Règles : fond d'écran = `sand`, texte = `forest` ; jamais de blanc pur en fond d'écran ; jamais de couleur hex inline dans un composant — toujours les tokens du `tailwind.config.js` mobile.

### Typographie

- Titres : **Poppins** (semibold/bold) — charger via `@expo-google-fonts/poppins`.
- Corps : **Raleway** (regular/medium) — `@expo-google-fonts/raleway`.
- Échelle : titre écran 24, titre section 18, corps 16, secondaire 14, caption 12. Minimum absolu 12.
- Respecter le Dynamic Type : ne pas bloquer `allowFontScaling` ; les layouts doivent survivre à une police agrandie.

### Rayons, ombres, espacements

- Radius de base 12 (`rounded-lg` = 12, `xl` = 16, `2xl` = 20). Cartes : `rounded-xl`. Boutons : `rounded-lg`, gros CTA `rounded-xl`.
- Ombres douces teintées forest : élévation faible (`shadowColor: '#1E5631'`, opacity 0.08, radius 12) ; CTA lime avec glow (`shadowColor: '#B4DD7F'`, opacity 0.5).
- Grille d'espacement : multiples de 4. Padding horizontal d'écran : 16. Entre cartes : 12. Entre sections : 24.

## 2. Composants

- Réutiliser les composants de `apps/mobile/components/ui/` (Button, Input, Card…) — ne jamais créer de variante ad hoc dans un écran. S'il manque un composant, le créer dans `components/ui/` avec variantes, en s'inspirant de l'équivalent web (`apps/web/components/ui/`).
- Button : variantes `primary` (fond lime / texte forest), `forest`, `outline`, `ghost`, `destructive` ; hauteurs 44 (default), 56 (lg) ; état `loading` avec spinner intégré ; feedback pressed = scale 0.98 + couleur pressed (via `Pressable`).
- Icônes : `lucide-react-native` (cohérence avec le web qui utilise lucide-react). Taille standard 20-24.

### Composants existants (mis à jour après l'onglet Jardins)

| Composant | Usage |
|---|---|
| `Button` | Variantes ci-dessus, prop `icon` pour une icône avant le libellé |
| `Input` | Label, `error`, `hint`, `revealable` pour les mots de passe |
| `Card` + `CardTitle`, `CardDescription` | Carte, tactile si `onPress` est fourni |
| `OptionGroup` | Choix parmi quelques valeurs, en pastilles. Préféré à un sélecteur natif tant que la liste est courte (≤ 6) : tout reste visible sans ouvrir de surcouche |
| `states.tsx` → `ListSkeleton`, `ErrorState`, `EmptyState` | Les trois états non-succès, à utiliser tels quels |
| `EmojiPicker` | Grille des 12 emojis de jardin (mêmes valeurs que le web). **Jamais de champ texte pour un emoji** : cela oblige à ouvrir le clavier emoji et à chercher |
| `CatalogSearch` | Autocomplétion sur le catalogue d'espèces : vignette, nom scientifique, badge toxique, tags, et repli « saisie à la main » |
| `CareLogSheet` | Saisie détaillée d'un geste, champs adaptés au type (quantité + unité, état de santé, produit employé) |
| `WeatherBanner` + `WeatherUnavailable` | Bandeau météo du jour et son repli quand l'utilisateur n'a pas de coordonnées |
| `TaskRow` | Ligne de tâche du planning : case à cocher, priorité en pastille, accès à la fiche plante |
| `AlertCard` | Alerte du moteur (gel, canicule, sécheresse, maladie), gravité portée par le fond |
| `TaskCard` | Carte d'une tâche prioritaire : grande photo, geste en titre, validation pleine largeur |
| `PlantGridCard` | Carte de la grille « Mes plantes », calquée sur celle du web |
| `StatCard` | Indicateur chiffré de l'accueil ; la couleur vient d'`indicatorTone` (`@growi/shared`) et se porte sur un liseré, jamais sur le fond |
| `Toggle` | Interrupteur d'un réglage, natif mais teinté Growi |
| `weather/` → `WeatherNow`, `ForecastRow`, `GardenContextCard`, `WeeklyTips`, `WeatherUnavailable` | La météo du jardin, portée de la page Météo du web ; `WeatherIcon` relie un code WMO à son composant lucide |

### Conventions retenues sur les écrans de liste

- **Squelettes, pas de spinner** : `ListSkeleton` reprend la silhouette des cartes à venir.
- **Formulaires alimentés par une requête** : monter le formulaire *après* le chargement (composant interne recevant la donnée), plutôt que d'initialiser `useForm` avec des valeurs absentes puis de le réinitialiser.
- **Champs numériques** : le clavier renvoie du texte. Étendre le schéma partagé avec une version texte du champ (`z.string().refine(...)`) et convertir à la soumission, plutôt que de contourner la validation.
- **Effacer un champ facultatif** : envoyer `null` (et non `''` ni `undefined`) ; les schémas de `@growi/shared` distinguent « effacer » de « laisser inchangé ».
- **Pas de fausse affordance** : une carte ne devient tactile que si sa destination existe. Mieux vaut une carte inerte qu'un lien qui mène au mauvais écran.
- **Navigation en pile dans un onglet** : `app/(tabs)/<onglet>/_layout.tsx` avec un `Stack`, pour conserver la barre d'onglets et le geste de retour iOS. Création et édition en `presentation: 'modal'` avec un bouton *Annuler* à gauche de l'en-tête.
- **Saisie assistée plutôt que libre** : dès qu'une valeur existe en base, la proposer (recherche débouncée 250 ms, minimum 2 caractères) au lieu de la faire saisir. Un formulaire libre est un repli, pas le chemin principal.
- **Messages d'erreur** : passer par `lib/errors.ts` (`errorMessage`), qui traduit une `ApiError` en phrase actionnable. Ne jamais afficher `error.message` brut.
- **Pas d'`Intl`** : Hermes n'embarque pas les données de locale sur toutes les plateformes. Dates en toutes lettres (`lib/dates.ts`), accords et unités (`formatHarvest` dans `@growi/shared`) sont écrits à la main — l'app n'est qu'en français.
- **Contenu partagé avec le web** dans `@growi/shared`, y compris les libellés et conseils (codes météo, correspondance tâche → geste). Ne rester local que ce qui l'est vraiment : la liaison d'un nom d'icône à son composant, `lucide-react` d'un côté, `lucide-react-native` de l'autre.
- **Ne pas désactiver une liste entière** pendant une mutation optimiste : la ligne cochée disparaît déjà, et on coche souvent plusieurs tâches d'affilée.

## 3. Règles UX mobile (non négociables)

1. **Zones tactiles ≥ 44×44 pt** pour tout élément interactif (utiliser `hitSlop` si le visuel est plus petit).
2. **Safe areas** : chaque écran enveloppé via react-native-safe-area-context ; jamais de contenu sous l'encoche ou le home indicator.
3. **Zone du pouce** : action principale de l'écran en bas ; pas d'action critique uniquement en haut à droite.
4. **Chaque écran gère 4 états** : loading (skeletons, pas de spinner plein écran), erreur (message + bouton réessayer), vide (illustration + texte encourageant + CTA), succès. Aucun écran ne peut afficher un blanc.
5. **Feedback immédiat** : actions rapides (« J'ai arrosé ») = optimistic update + toast discret ; jamais d'attente bloquante pour une action simple.
6. **Clavier** : formulaires dans `KeyboardAvoidingView` (+ `keyboardShouldPersistTaps="handled"`) ; le champ actif reste visible ; `returnKeyType` cohérent (next/done).
7. **Pull-to-refresh** sur toutes les listes (RefreshControl teinté lime).
8. **Navigation** : geste back iOS toujours fonctionnel ; création/édition en modale (`presentation: 'modal'`) avec bouton Annuler explicite ; confirmation avant toute suppression (Alert native).
9. **Accessibilité** : `accessibilityLabel` sur les boutons-icônes ; contraste texte ≥ 4.5:1 (attention : lime sur sand est insuffisant pour du texte — lime uniquement en fond de CTA avec texte forest) ; `accessibilityRole` correct.
10. **Animations** : sobres, 150-250 ms ; respecter `useReducedMotion` (react-native-reanimated).

## 4. Responsive

- **Flexbox fluide uniquement** : jamais de largeur fixe en px pour les conteneurs ; `flex-1`, pourcentages, `gap`.
- Cibles de test : iPhone SE (375×667, petit) et iPhone Pro Max (430×932) minimum, + un Android (Pixel). Un écran validé = vérifié sur petit ET grand.
- Textes longs : `numberOfLines` + ellipsis sur les cartes ; jamais de débordement.
- Images : `expo-image` avec `contentFit="cover"`, placeholder blurhash ou couleur `sand-dark`.
- Pas de scroll horizontal sauf carrousel volontaire.

## 5. Ton et contenu (UX writing)

- Français, tutoiement, ton chaleureux et encourageant (« Ton jardin est à jour 🌿 », pas « Aucune tâche »).
- Messages d'erreur : dire quoi faire, pas le code technique (« Impossible de contacter le serveur — réessaie dans un instant »).
- États vides : toujours orienter vers l'action suivante (CTA).

## 6. Checklist de validation d'un écran

Avant de considérer un écran terminé, vérifier : tokens (aucune couleur/police hors design system) · 4 états implémentés · safe areas · zones tactiles 44 pt · clavier géré (si formulaire) · pull-to-refresh (si liste) · testé SE + Pro Max · accessibilityLabels · textes français ton Growi.
