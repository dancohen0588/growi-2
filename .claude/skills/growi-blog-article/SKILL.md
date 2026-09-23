---
name: growi-blog-article
description: Rédiger à la main un article du blog « Conseils » de Growi et l'enregistrer en brouillon. À utiliser dès qu'on demande d'écrire, rédiger ou préparer un article de blog, un conseil de saison ou une annonce produit (tag actus-growi) — produit le JSON attendu par generatedArticleSchema, le contrôle, puis l'insère en DRAFT via pnpm blog:generate --from-file.
---

# Rédiger un article « Conseils » à la main

Le blog vit en base ; un article se **relit et se publie dans `/admin/conseils`**,
jamais depuis ce skill. Ce skill produit un **brouillon**, exactement au format
d'un article généré, et le fait passer par les mêmes contrôles.

Cas typiques : une annonce produit (`actus-growi`, seul tag que la génération
automatique ne produit jamais), un sujet que le générateur traite mal, un
article demandé par quelqu'un de l'équipe.

## 1. Lire la source de vérité — avant d'écrire une ligne

`apps/web/lib/blog/editorial.ts` **fait foi**. Le lire à chaque fois, il évolue :

- `ARTICLE_SYSTEM_PROMPT` — ton, structure, interdits, format de réponse. Ce
  sont les consignes que suit le générateur ; les suivre à la lettre.
- `SEASONAL_CALENDAR` et `EDITORIAL_WINDOW_DAYS` — un article sort **3 à 5
  semaines avant** le moment où le geste est à faire.
- `lintArticle` et `FORBIDDEN_TERMS` — ce qui sera refusé.

Et `packages/shared/src/schemas/blog.ts` pour `generatedArticleSchema` et
`BLOG_TAGS`.

## 2. Les règles qui ne se discutent pas

- **Jamais le mot « IA »**, ni « intelligence artificielle », ni aucune
  mention d'un modèle, d'un assistant ou de la façon dont le texte a été
  produit — titre, extrait et corps compris. C'est bloquant à l'import **et** à
  la publication.
- **Tutoiement**, jamais « vous ».
- **Concret** : des seuils, des durées, des quantités. Pas de « régulièrement »
  sans chiffre (signalé au relecteur).
- **L'auteur affiché est « Growi »** — il est posé par le serveur, ne pas
  chercher à le changer.
- Ni personnes, ni marques, ni prix ; pas de produit phytosanitaire de synthèse.
- 800 à 1200 mots, un `##` tous les 200–300 mots (au moins 3), au moins un
  `<Callout tone="conseil" title="…">…</Callout>` (ou `tone="attention"`).
  Aucun HTML, aucune image, aucun lien externe dans le corps.

## 3. Éviter les doublons

Regarder les articles existants dans `/admin/conseils` (tous statuts). Un titre
trop proche d'un existant (Jaccard > 0,6 sur les mots) est refusé à l'import.

## 4. Écrire le JSON

Un fichier **hors du dépôt** (le scratchpad de la session, ou `$TMPDIR`) :

```json
{
  "title": "30 à 70 caractères (80 au plus)",
  "slug": "minuscules-sans-accents-separees-par-des-tirets",
  "excerpt": "80 à 150 caractères (160 au plus) : méta-description et résumé de carte",
  "tags": ["entretien", "saison"],
  "mdx": "Le corps, sans le titre. Sauts de ligne en \\n dans le JSON.",
  "coverPrompt": "En anglais : photo documentaire du sujet concret, cadre français, lumière rasante… No people, no text, no logos, no watermark.",
  "coverImageAlt": "En français, ce qu'on voit sur l'image (20 à 200 caractères)",
  "reviewerNotes": ["Chaque chiffre, date, dose, température ou affirmation botanique à vérifier — 1 à 15 notes"]
}
```

- `tags` : 1 ou 2 valeurs de `BLOG_TAGS`. Le **premier** sert d'étiquette sur
  la carte publique.
- `reviewerNotes` : même écrit à la main, un article se fait relire. Lister ce
  qu'un relecteur doit vérifier, du plus risqué au moins risqué.
- Le corps MDX contient des guillemets (`tone="conseil"`) : les échapper dans
  le JSON (`\"`). Le plus sûr est d'écrire le JSON avec un petit script plutôt
  qu'à la main.

## 5. Contrôler, puis enregistrer

Depuis la racine du dépôt :

```bash
pnpm --filter web blog:generate --from-file /chemin/article.json --dry-run
```

Corriger chaque défaut signalé (il est dit avec la mesure : « l'extrait fait
170 caractères, 160 au plus »), relancer jusqu'à « Contrôles passés ». Puis :

```bash
pnpm --filter web blog:generate --from-file /chemin/article.json
```

Le script écrit dans la base pointée par `apps/web/.env` — **c'est la base de
production** : l'article n'est qu'un brouillon, invisible hors de l'admin, mais
il compte dans le plafond de deux brouillons qui arrête la génération
automatique. Le signaler à l'utilisateur.

## 6. Après

- Donner à l'utilisateur le lien `/admin/conseils/<id>` affiché par le script :
  c'est là qu'il relit, corrige et publie.
- La couverture est **à produire** : le prochain passage du cron la
  rattrapera, ou `pnpm --filter web blog:generate --cover <slug>` la produit
  tout de suite (facturation Gemini requise pour les images).
- Ne jamais publier depuis la base ou un script : la publication passe par
  l'admin, qui la journalise et revalide le site.
