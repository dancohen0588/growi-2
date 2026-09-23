/**
 * Compilation **et rendu** réels d'un corps d'article, avec la chaîne et les
 * composants du site — le contrôle qualité qui précède toute écriture en base.
 *
 * Compiler ne suffit pas : un composant inconnu (`<Encadre>`) compile très
 * bien, et ne lève qu'au rendu. On rend donc en HTML, comme pour le mobile.
 *
 * Les imports sont dynamiques, comme dans `content.ts` : le compilateur MDX et
 * `react-dom/server` n'ont rien à faire dans le graphe des pages.
 */

export type CompileResult = { ok: true; html: string } | { ok: false; error: string }

export async function compileArticleMdx(source: string): Promise<CompileResult> {
  const [{ compileMDX }, { renderToStaticMarkup }, { htmlMdxComponents }, { mdxOptions }] =
    await Promise.all([
      import('next-mdx-remote/rsc'),
      import('react-dom/server'),
      import('./mdx-components'),
      import('./mdx-options'),
    ])

  try {
    const { content } = await compileMDX({
      source,
      components: htmlMdxComponents,
      options: { mdxOptions },
    })
    return { ok: true, html: renderToStaticMarkup(content) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Première ligne seulement : la suite est une pile interne au compilateur,
    // illisible pour l'admin comme pour le modèle à qui on la renvoie.
    return { ok: false, error: message.split('\n')[0].slice(0, 300) }
  }
}
