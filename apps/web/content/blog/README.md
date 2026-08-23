# Publier un article sur le blog Growi

Le blog n'a pas de CMS : **un article = un fichier `.mdx` dans ce dossier**.
Publier, c'est ajouter le fichier, commiter, pousser. Vercel déploie, et
l'article apparaît sur `/blog` et dans l'app mobile en même temps.

## 1. Créer le fichier

Le **nom du fichier est le slug** de l'article, en kebab-case, sans accent :

```
content/blog/preparer-son-potager-en-septembre.mdx
   →  https://growi.app/blog/preparer-son-potager-en-septembre
```

Choisis-le une fois pour toutes : le renommer casse les liens déjà partagés et
les positions acquises en référencement.

## 2. Le frontmatter

En tête de fichier, entre deux lignes `---`. Il est **validé au build** : un
champ manquant ou un tag inconnu fait échouer la compilation avec le nom du
fichier fautif — mieux vaut ça qu'un article publié à moitié.

```yaml
---
title: "Préparer son potager en septembre"
excerpt: "Semis d'automne, engrais verts, derniers arrosages : la check-list du mois."
coverImage: "/blog/preparer-son-potager-en-septembre/cover.png"
coverImageAlt: "Potager en fin d'été, lumière rasante sur les rangs"
publishedAt: "2026-09-01"
updatedAt: "2026-09-15"        # facultatif — vaut publishedAt par défaut
tags: [potager, saison]
author: "Dan"                  # facultatif — « Growi » par défaut
draft: false
---
```

| Champ | Obligatoire | Notes |
|---|---|---|
| `title` | oui | Sert de `h1` et de balise `title`. Vise 50–60 caractères. |
| `excerpt` | oui | Sert de méta-description et de résumé de carte. **≤ 160 caractères.** |
| `coverImage` | non | Chemin absolu depuis `public/`. Sans elle, la carte affiche un dégradé. |
| `coverImageAlt` | non | Description de l'image pour les lecteurs d'écran. À remplir dès qu'il y a une couverture. |
| `publishedAt` | oui | `YYYY-MM-DD`. Détermine l'ordre de la liste (plus récent en premier). |
| `updatedAt` | non | Affiché en bas d'article et utilisé comme `lastModified` du sitemap. |
| `tags` | oui | Au moins un, parmi la liste ci-dessous. Le premier sert d'étiquette sur la carte. |
| `author` | non | Nom affiché. |
| `draft` | oui | `true` = invisible en production, visible en `pnpm --filter web dev`. |

### Tags autorisés

`saison` · `potager` · `entretien` · `maladies` · `actus-growi`

La liste fait foi dans [`packages/shared/src/schemas/blog.ts`](../../../../packages/shared/src/schemas/blog.ts).
En ajouter un demande de l'ajouter là-bas (et de lui donner un libellé
d'affichage) — pas seulement ici.

## 3. Les images

Un dossier par article, nommé comme le slug :

```
public/blog/<slug>/cover.png
public/blog/<slug>/oidium-face-inferieure.jpg
```

Référence-les en chemin absolu dans le MDX : `![Oïdium sur courgette](/blog/<slug>/oidium.jpg)`.

- Couverture : **1200 × 630** (format OpenGraph, c'est aussi la vignette
  affichée quand l'article est partagé).
- Toujours renseigner un texte alternatif, y compris pour les images du corps.
- Les couvertures actuelles sont des **dégradés générés**, à remplacer par de
  vraies photos.

## 4. Écrire

Du Markdown standard, plus les tableaux et listes de tâches (`remark-gfm`).
Chaque `##` reçoit automatiquement une ancre, ce qui permet de pointer un
paragraphe précis.

Deux composants sont disponibles dans le corps de l'article :

```mdx
<Callout title="Le calcul à faire avant chaque semis">
Texte du conseil. Ton `tone` par défaut est « conseil » (vert).
</Callout>

<Callout tone="attention" title="Le mildiou ne se rattrape pas">
Pour les mises en garde (jaune).
</Callout>

<YouTube id="dQw4w9WgXcQ" title="Tailler un rosier en 3 minutes" />
```

C'est volontairement tout ce qui existe en V1. Un composant de plus, c'est un
composant à maintenir aussi dans le rendu HTML servi au mobile.

### Le ton Growi

- **Tutoiement**, toujours.
- **Concret** : des seuils, des durées, des quantités. « Arroser régulièrement »
  ne veut rien dire ; « tous les quatre jours, au pied, le matin » si.
- **Saisonnier** : un article se lit au moment où on en a besoin.
- Le produit se mentionne quand il résout vraiment le problème du paragraphe,
  pas à chaque section.
- 800 à 1200 mots, des `##` tous les 200–300 mots, au moins un `<Callout>`.

## 5. Relire et publier

```bash
pnpm --filter web dev          # /blog affiche aussi les draft: true
pnpm --filter web test         # valide le frontmatter et la compilation MDX
pnpm --filter web typecheck
```

Une fois relu, passe `draft` à `false`, commit, push. C'est tout : pas de
revalidation à déclencher, pas de webhook — le contenu est dans le build.

## Où ça vit dans le code

| Fichier | Rôle |
|---|---|
| `apps/web/lib/blog/content.ts` | Seul module qui lit ce dossier. À réécrire si un CMS arrive un jour. |
| `apps/web/lib/blog/mdx-components.tsx` | `Callout`, `YouTube` et les balises surchargées. |
| `apps/web/app/(marketing)/blog/` | Pages liste et article. |
| `packages/shared/src/schemas/blog.ts` | Contrat de données partagé avec le mobile. |
