/**
 * Génère un brouillon d'article « Conseils », comme le fera le cron — pour
 * essayer les prompts en vrai, avec la clé Gemini.
 *
 *   pnpm --filter web blog:generate
 *   pnpm --filter web blog:generate --topic "Pailler ses massifs avant l'hiver"
 *   pnpm --filter web blog:generate --cover <slug>   # couverture seule
 *   pnpm --filter web blog:generate --from-file article.json [--dry-run]
 *
 * `--from-file` enregistre un article **écrit à la main** (skill Claude Code
 * `growi-blog-article`), au format `generatedArticleSchema`, après les mêmes
 * contrôles qu'une génération. `--dry-run` contrôle sans rien écrire.
 *
 * Écrit un **brouillon** (`origin = manual`) dans la base pointée par `.env` :
 * rien n'est publié, l'article ne se voit que dans l'admin. Le plafond de deux
 * brouillons s'applique comme partout — en supprimer un pour relancer.
 *
 * Pas de limite Vercel ici : le budget est large, pour laisser jouer la
 * reprise. Le résultat affiche les notes pour le relecteur et, en cas d'échec,
 * les défauts de la dernière version refusée : c'est ce qui sert à régler
 * `lib/blog/editorial.ts`.
 */

import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const LOCAL_BUDGET_MS = 150_000

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main() {
  // Import différé : Prisma lit `DATABASE_URL` à la construction du client,
  // donc après le chargement des variables.
  const { generateArticle } = await import('@/lib/services/blog-generator.service')
  const { prisma } = await import('@/lib/prisma')

  const topic = argument('--topic')
  const coverSlug = argument('--cover')
  const fromFile = argument('--from-file')
  const startedAt = Date.now()

  try {
    if (coverSlug) {
      await coverOnly(coverSlug)
      return
    }
    if (fromFile) {
      await importFromFile(fromFile, process.argv.includes('--dry-run'))
      return
    }

    const result = await generateArticle({ origin: 'manual', topic, timeBudgetMs: LOCAL_BUDGET_MS })
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)

    if (!result.ok) {
      console.error(`\n✗ Échec à l'étape « ${result.stage} » après ${seconds} s : ${result.reason}`)
      for (const issue of result.issues ?? []) console.error(`  - ${issue}`)
      process.exitCode = 1
      return
    }

    const { post, attempts } = result
    const notes = Array.isArray(post.reviewerNotes) ? (post.reviewerNotes as string[]) : []

    console.log(`\n✓ Brouillon créé en ${seconds} s (${attempts} rédaction(s))`)
    console.log(`  ${post.title}`)
    console.log(`  slug    : ${post.slug}`)
    console.log(`  tags    : ${post.tags.join(', ')}`)
    console.log(`  extrait : ${post.excerpt}`)
    console.log(`  pourquoi: ${post.topicRationale ?? '—'}`)
    console.log(`\nÀ vérifier avant publication :`)
    for (const note of notes) console.log(`  - ${note}`)
    console.log(`\nPrompt de couverture :\n  ${post.coverPrompt}`)
    console.log(result.cover?.ok
      ? `Couverture : ${result.cover.url} (${result.cover.imageMs} ms)`
      : `Couverture : à produire (${result.cover ? result.cover.reason : 'pas le temps'})`)
    console.log(`\nAdmin : /admin/conseils/${post.id}`)
  } finally {
    await prisma.$disconnect()
  }
}

/** Un article écrit à la main, contrôlé puis enregistré en brouillon. */
async function importFromFile(path: string, dryRun: boolean) {
  const { readFileSync } = await import('node:fs')
  const { createManualDraft } = await import('@/lib/services/blog-generator.service')

  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`Fichier illisible (${path}) : ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
    return
  }

  const result = await createManualDraft(json, { dryRun })
  if (!result.ok) {
    console.error('\n✗ Article refusé :')
    for (const issue of result.issues) console.error(`  - ${issue}`)
    process.exitCode = 1
    return
  }

  for (const warning of result.warnings) console.warn(`  ⚠ ${warning}`)
  if (!result.post) {
    console.log('\n✓ Contrôles passés (dry-run : rien n’a été écrit).')
    return
  }
  console.log(`\n✓ Brouillon créé : ${result.post.title}`)
  console.log(`  slug  : ${result.post.slug}`)
  console.log(`  Admin : /admin/conseils/${result.post.id}`)
}

/** Rejoue l'étape image seule, comme le bouton « Régénérer l'image » de l'admin. */
async function coverOnly(slug: string) {
  const { generateCover } = await import('@/lib/services/blog-cover.service')
  const { prisma } = await import('@/lib/prisma')

  const post = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })
  if (!post) {
    console.error(`Aucun article « ${slug} ».`)
    process.exitCode = 1
    return
  }

  const cover = await generateCover(post.id, { budgetMs: LOCAL_BUDGET_MS })
  if (cover.ok) {
    console.log(`\n✓ Couverture prête en ${(cover.imageMs / 1000).toFixed(1)} s : ${cover.url}`)
  } else {
    console.error(`\n✗ Couverture non produite : ${cover.reason}`)
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
