/**
 * Import des articles `content/blog/*.mdx` en base, avec leur couverture.
 *
 *   pnpm --filter web blog:import
 *   pnpm --filter web blog:import --dry-run
 *
 * Écrit pour la bascule du blog des fichiers vers la base (spec
 * « génération automatique d'articles », § 9). **Idempotent** : l'article est
 * retrouvé par son slug et mis à jour, et une couverture déjà déposée dans
 * `blog-covers` n'est pas renvoyée — relancer ne crée ni doublon ni fichier
 * orphelin.
 *
 * Chaque article garde ses dates d'origine ; l'auteur affiché devient
 * « Growi », comme pour tous les articles désormais. Un frontmatter
 * `draft: true` donne un brouillon, visible seulement dans l'admin.
 *
 * Les variables sont lues comme le fait `next dev` (`.env`, puis `.env.local`),
 * d'où `@next/env` : `SUPABASE_URL` ne vit que dans le second.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

import { loadEnvConfig } from '@next/env'
import { PrismaClient } from '@prisma/client'
import matter from 'gray-matter'
import { blogFrontmatterSchema, type BlogCoverStatus, type BlogPostStatus } from '@growi/shared'

import { toCoverJpeg } from '@/lib/blog/cover-image'
import { deleteCoverByUrl, uploadCover } from '@/lib/storage'

loadEnvConfig(process.cwd())

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')
const PUBLIC_DIR = path.join(process.cwd(), 'public')

function toDate(value: string | Date, file: string, field: string): Date {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${file} : ${field} invalide (${String(value)})`)
  }
  return date
}

/** Une couverture est « à nous » si elle est déjà dans le bucket `blog-covers`. */
function isStoredCover(url: string | null | undefined): boolean {
  return !!url && url.includes('/storage/v1/object/public/blog-covers/')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const prisma = new PrismaClient()

  const files = existsSync(CONTENT_DIR)
    ? readdirSync(CONTENT_DIR).filter(file => file.endsWith('.mdx')).sort()
    : []

  if (files.length === 0) {
    console.log('Aucun fichier .mdx dans content/blog : rien à importer.')
    return
  }

  try {
    for (const file of files) {
      const slug = file.replace(/\.mdx$/, '')
      const { data, content } = matter(readFileSync(path.join(CONTENT_DIR, file), 'utf8'))

      const parsed = blogFrontmatterSchema.safeParse(data)
      if (!parsed.success) {
        const details = parsed.error.issues
          .map(issue => `  - ${issue.path.join('.') || '(racine)'} : ${issue.message}`)
          .join('\n')
        throw new Error(`Frontmatter invalide dans ${file} :\n${details}`)
      }
      const front = parsed.data

      const publishedAt = toDate(front.publishedAt, file, 'publishedAt')
      const updatedAt = front.updatedAt ? toDate(front.updatedAt, file, 'updatedAt') : publishedAt
      const status: BlogPostStatus = front.draft ? 'DRAFT' : 'PUBLISHED'

      const existing = await prisma.blogPost.findUnique({ where: { slug } })

      // Couverture : on ne renvoie pas une image déjà déposée par un passage
      // précédent — ce serait un fichier orphelin de plus à chaque relance.
      let coverImage: string | null = existing?.coverImage ?? null
      if (!isStoredCover(coverImage) && front.coverImage) {
        const source = path.join(PUBLIC_DIR, front.coverImage)
        if (!existsSync(source)) throw new Error(`${file} : couverture introuvable (${source})`)

        const jpeg = await toCoverJpeg(readFileSync(source))
        console.log(`  couverture ${front.coverImage} → ${(jpeg.byteLength / 1024) | 0} Ko`)
        coverImage = dryRun ? '(dry-run)' : (await uploadCover(slug, jpeg)).url
      }
      const coverStatus: BlogCoverStatus = coverImage ? 'READY' : 'NONE'

      const fields = {
        title: front.title,
        excerpt: front.excerpt,
        source: content.trim() + '\n',
        coverImage,
        coverImageAlt: front.coverImageAlt,
        coverStatus,
        tags: front.tags,
        author: 'Growi',
        status,
        origin: 'manual',
        publishedAt: status === 'PUBLISHED' ? publishedAt : null,
        // `@updatedAt` accepte une valeur explicite : on garde celle du fichier,
        // sans quoi chaque article afficherait la date de l'import.
        updatedAt,
      }

      console.log(`${existing ? 'maj ' : 'créé'} ${slug} (${status})`)
      if (dryRun) continue

      await prisma.blogPost.upsert({
        where: { slug },
        create: { slug, ...fields, createdAt: publishedAt },
        update: fields,
      })

      // Une URL remplacée (ancienne couverture du bucket) ne sert plus.
      if (existing?.coverImage && existing.coverImage !== coverImage) {
        await deleteCoverByUrl(existing.coverImage)
      }
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log(dryRun ? '\nDry-run : rien n\'a été écrit.' : `\n${files.length} article(s) importé(s).`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
