/**
 * Insère en base les secrets de la bibliothèque de départ qui manquent
 * (`lib/secrets/library.ts`), et pose la planche de ceux qui n'en ont pas
 * encore — chaque lot de dessins en apporte. N'écrase jamais une astuce ni une
 * planche existantes : une fois en base, c'est l'admin `/admin/secrets` qui
 * fait foi.
 *
 *   pnpm --filter web secrets:seed                            # les secrets absents
 *   pnpm --filter web secrets:seed --planches eau-riz,cendres  # + les planches d'un lot
 *   pnpm --filter web secrets:seed --sql                      # imprime le SQL, n'écrit rien
 *
 * Les planches ne sont posées que pour les slugs nommés, et seulement là où il
 * n'y en a pas : un admin qui a retiré une planche ne la verra pas revenir au
 * lot suivant.
 *
 * La migration `…_garden_secrets` a été générée avec `--sql`.
 */

import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  const { SECRET_LIBRARY } = await import('../lib/secrets/library')
  const { seedInsertSql, seedPlancheSql } = await import('../lib/secrets/seed-sql')
  const insert = seedInsertSql(SECRET_LIBRARY)
  const flag = process.argv.indexOf('--planches')
  const slugs = flag >= 0 ? (process.argv[flag + 1] ?? '').split(',').map((slug) => slug.trim()).filter(Boolean) : []
  const unknown = slugs.filter((slug) => !SECRET_LIBRARY.some((tip) => tip.slug === slug && tip.planche))
  if (unknown.length > 0) throw new Error(`Pas de planche dans la bibliothèque pour : ${unknown.join(', ')}`)
  const planches = seedPlancheSql(SECRET_LIBRARY, slugs)

  if (process.argv.includes('--sql')) {
    process.stdout.write(`${insert}\n${planches}\n`)
    return
  }

  const { prisma } = await import('../lib/prisma')
  const inserted = await prisma.$executeRawUnsafe(insert)
  const drawn = planches ? await prisma.$executeRawUnsafe(planches) : 0
  console.log(`${inserted} secret(s) ajouté(s), ${drawn} planche(s) posée(s).`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
