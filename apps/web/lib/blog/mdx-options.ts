import type { MDXRemote } from 'next-mdx-remote/rsc'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

/**
 * `next-mdx-remote` n'exporte pas publiquement le type de ses options : on le
 * dérive de la signature de `MDXRemote`, seule surface stable du paquet.
 */
type MdxOptions = NonNullable<NonNullable<Parameters<typeof MDXRemote>[0]['options']>['mdxOptions']>

/**
 * Chaîne de compilation MDX, partagée par le rendu web et le HTML servi au
 * mobile — les deux doivent produire les mêmes ancres et les mêmes tableaux.
 *
 * - `remark-gfm` : tableaux, listes de tâches, liens automatiques ;
 * - `rehype-slug` + `rehype-autolink-headings` : une ancre par intertitre, pour
 *   pouvoir pointer un paragraphe précis depuis un partage.
 */
export const mdxOptions: MdxOptions = {
  remarkPlugins: [remarkGfm],
  rehypePlugins: [
    rehypeSlug,
    [
      rehypeAutolinkHeadings,
      {
        behavior: 'wrap',
        properties: { className: 'heading-anchor' },
      },
    ],
  ],
}
