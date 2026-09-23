/**
 * Compilation réelle d'un corps d'article, avec la chaîne et les composants du
 * site — le contrôle qualité qui précède toute écriture en base.
 *
 * On compile, on ne rend pas. Un rendu (`renderToStaticMarkup`) attraperait
 * aussi un composant inconnu, mais ce module est appelé **pendant le rendu des
 * pages de l'admin** : le moteur de `react-dom/server` y manipule l'état global
 * de React que partage le rendu en flux des autres requêtes, et le serveur de
 * développement tombait en « Cannot read properties of null (reading
 * 'useContext') ». Les composants inconnus sont de toute façon refusés par le
 * lint d'`editorial.ts` (toute balise autre que Callout et YouTube).
 *
 * Les imports sont dynamiques, comme dans `content.ts` : le compilateur MDX n'a
 * rien à faire dans le graphe des pages qui ne s'en servent pas.
 */

export type CompileResult = { ok: true } | { ok: false; error: string }

export async function compileArticleMdx(source: string): Promise<CompileResult> {
  const [{ compileMDX }, { htmlMdxComponents }, { mdxOptions }] = await Promise.all([
    import('next-mdx-remote/rsc'),
    import('./mdx-components'),
    import('./mdx-options'),
  ])

  try {
    await compileMDX({ source, components: htmlMdxComponents, options: { mdxOptions } })
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Première ligne seulement : la suite est une pile interne au compilateur,
    // illisible pour l'admin comme pour le modèle à qui on la renvoie.
    return { ok: false, error: message.split('\n')[0].slice(0, 300) }
  }
}
