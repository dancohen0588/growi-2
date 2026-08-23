import { BLOG_TAG_LABELS, type BlogPost } from '@growi/shared'

import { formatArticleDate } from '@/lib/dates'

/**
 * Document HTML complet d'un article, prêt pour la WebView.
 *
 * L'en-tête (couverture, tag, titre, méta) est fabriqué ici plutôt qu'en
 * composants React Native au-dessus de la WebView : deux zones défilantes
 * empilées se battraient pour le geste de scroll, et le lecteur en subirait
 * les à-coups. Un seul document, un seul défilement.
 *
 * La feuille de style reprend `.article-prose` du site : mêmes tokens, mêmes
 * proportions, pour qu'un article se lise pareil des deux côtés.
 */

const TOKENS = {
  sand: '#F9F7E8',
  sandDark: '#ede9cc',
  card: 'hsl(52 50% 97%)',
  forest: '#1E5631',
  lime: '#B4DD7F',
  sun: '#F6C445',
  muted: 'hsl(139 20% 40%)',
  border: 'hsl(139 20% 80%)',
} as const

/**
 * Les polices du design system, chargées depuis Google Fonts.
 *
 * Celles empaquetées dans l'app ne sont pas accessibles au moteur de rendu de
 * la WebView. Hors ligne, la pile de repli prend le relais — le texte reste
 * lisible, seule la fonte change.
 */
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Raleway:wght@400;600&display=swap'

const SANS = "'Raleway', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
const DISPLAY = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function styles(fontScale: number): string {
  // La WebView ignore le Dynamic Type : on lui repasse l'échelle du système,
  // bornée pour que la mise en page tienne aux réglages extrêmes.
  const base = Math.round(17 * Math.min(Math.max(fontScale, 1), 1.6))

  return `
    @import url('${FONTS_URL}');

    * { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 0 16px 48px;
      background: ${TOKENS.sand};
      color: ${TOKENS.forest};
      font-family: ${SANS};
      font-size: ${base}px;
      line-height: 1.75;
      -webkit-text-size-adjust: none;
      overflow-wrap: break-word;
    }

    /* ── En-tête ── */
    .cover {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 20px;
      background: ${TOKENS.sandDark};
      margin-top: 8px;
    }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .tag {
      background: rgba(180, 221, 127, 0.3);
      border-radius: 999px;
      padding: 4px 10px;
      font-family: ${SANS};
      font-weight: 600;
      font-size: 0.75em;
    }
    h1 {
      font-family: ${DISPLAY};
      font-weight: 700;
      font-size: 1.6em;
      line-height: 1.25;
      margin: 12px 0 0;
    }
    .excerpt { color: ${TOKENS.muted}; margin: 12px 0 0; }
    .meta {
      color: ${TOKENS.muted};
      font-size: 0.8em;
      margin: 12px 0 0;
      padding-bottom: 20px;
      border-bottom: 1px solid ${TOKENS.border};
    }

    /* ── Corps, calqué sur .article-prose du site ── */

    /* Les marges par défaut du navigateur sont remises à plat, puis le
       rythme vertical est posé une seule fois entre frères. :where() ne
       compte pas dans la spécificité : la règle suivante l'emporte, et les
       titres gardent la leur. */
    .body :where(p, ul, ol, blockquote, pre, table, aside, img, iframe) { margin: 0; }
    .body > * + * { margin-top: 20px; }

    .body h2 {
      font-family: ${DISPLAY};
      font-weight: 700;
      font-size: 1.3em;
      line-height: 1.3;
      margin: 40px 0 12px;
    }
    .body h3 {
      font-family: ${DISPLAY};
      font-weight: 600;
      font-size: 1.1em;
      margin: 28px 0 8px;
    }
    .body p { color: rgba(30, 86, 49, 0.85); }
    .body a { color: ${TOKENS.forest}; font-weight: 600; text-decoration-color: ${TOKENS.lime}; text-decoration-thickness: 2px; text-underline-offset: 3px; }
    .body h2 a, .body h3 a { text-decoration: none; color: inherit; }
    .body strong { font-weight: 600; }
    .body ul, .body ol { padding-left: 22px; }
    .body li { margin-top: 8px; }
    .body li::marker { color: ${TOKENS.forest}; }
    .body img { width: 100%; height: auto; border-radius: 16px; }
    .body blockquote {
      padding-left: 16px;
      border-left: 4px solid ${TOKENS.lime};
      font-style: italic;
      color: ${TOKENS.muted};
    }
    .body code {
      background: rgba(30, 86, 49, 0.06);
      border-radius: 4px;
      padding: 2px 5px;
      font-size: 0.9em;
    }
    .body pre {
      background: ${TOKENS.forest};
      color: ${TOKENS.sand};
      border-radius: 16px;
      padding: 16px;
      overflow-x: auto;
    }
    .body pre code { background: none; padding: 0; color: inherit; }
    .body hr { border: none; border-top: 1px solid rgba(30, 86, 49, 0.12); margin: 32px 0; }

    /* Un tableau large défile dans son propre cadre — jamais la page. */
    .body table {
      display: block;
      overflow-x: auto;
      white-space: nowrap;
      border-collapse: collapse;
      width: 100%;
      font-size: 0.9em;
    }
    .body thead { border-bottom: 2px solid ${TOKENS.lime}; }
    .body th { font-family: ${DISPLAY}; font-weight: 600; text-align: left; padding: 8px 20px 8px 0; }
    .body td { padding: 8px 20px 8px 0; border-bottom: 1px solid rgba(30, 86, 49, 0.1); vertical-align: top; }

    /* Les encadrés Callout, rendus en <aside> par la compilation MDX. */
    .body aside {
      background: rgba(180, 221, 127, 0.2);
      border-left: 4px solid ${TOKENS.lime};
      border-radius: 16px;
      padding: 16px;
    }
    .body aside > p:first-child { font-family: ${DISPLAY}; font-weight: 700; margin-bottom: 8px; }
    /* Le contenu de l'encadré est enveloppé d'un div : le rythme entre frères
       du corps ne l'atteint pas, il faut le reposer ici. */
    .body aside > div > * + * { margin-top: 12px; }

    /* La variante « attention » du Callout porte les classes Tailwind du site :
       on les rattrape pour lui rendre sa couleur. */
    .body aside[class*="border-sun"] {
      background: rgba(246, 196, 69, 0.2);
      border-left-color: ${TOKENS.sun};
    }

    .body iframe { width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 16px; }
  `
}

/** Document complet à passer à la WebView. */
export function buildArticleHtml(post: BlogPost, fontScale = 1): string {
  const tags = post.tags
    .map((tag) => `<span class="tag">${escapeHtml(BLOG_TAG_LABELS[tag])}</span>`)
    .join('')

  const cover = post.coverImage
    ? `<img class="cover" src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.coverImageAlt ?? '')}">`
    : ''

  const meta = `${escapeHtml(formatArticleDate(post.publishedAt))} · ${post.readingTime} min de lecture · ${escapeHtml(post.author)}`

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${escapeHtml(post.title)}</title>
<style>${styles(fontScale)}</style>
</head>
<body>
${cover}
<div class="tags">${tags}</div>
<h1>${escapeHtml(post.title)}</h1>
<p class="excerpt">${escapeHtml(post.excerpt)}</p>
<p class="meta">${meta}</p>
<div class="body">${post.html}</div>
</body>
</html>`
}
