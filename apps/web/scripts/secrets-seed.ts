/**
 * Insère en base les secrets de la bibliothèque de départ qui manquent
 * (`lib/secrets/library.ts`). N'écrase jamais une astuce existante : une fois
 * en base, c'est l'admin `/admin/secrets` qui fait foi.
 *
 *   pnpm --filter web secrets:seed          # écrit dans la base de `.env`
 *   pnpm --filter web secrets:seed --sql    # imprime le SQL, n'écrit rien
 *
 * La migration `…_garden_secrets` a été générée avec `--sql`.
 */

import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

async function main() {
  const { SECRET_LIBRARY } = await import('../lib/secrets/library')
  const { seedInsertSql } = await import('../lib/secrets/seed-sql')
  const sql = seedInsertSql(SECRET_LIBRARY)

  if (process.argv.includes('--sql')) {
    process.stdout.write(`${sql}\n`)
    return
  }

  const { prisma } = await import('../lib/prisma')
  const inserted = await prisma.$executeRawUnsafe(sql)
  console.log(`${inserted} secret(s) ajouté(s), ${SECRET_LIBRARY.length - inserted} déjà en base.`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
