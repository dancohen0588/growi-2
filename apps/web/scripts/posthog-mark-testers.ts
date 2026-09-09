/**
 * Marque les comptes de la Friends & Family dans PostHog.
 *
 *   pnpm --filter web posthog:testers testeurs.txt
 *
 * `is_tester_ff` est la propriété de personne qui filtre tous les tableaux de
 * bord de la F&F. Elle n'est **jamais posée par le code applicatif** : rien
 * dans un parcours ne distingue un testeur d'un futur utilisateur, et une
 * règle automatique finirait par marquer les mauvais comptes. On la pose donc
 * ici, à la main, sur une liste qu'on a écrite.
 *
 * Le fichier attendu est une adresse par ligne ; les lignes vides et celles
 * qui commencent par `#` sont ignorées. **Il n'est pas versionné** — c'est une
 * liste de personnes réelles — d'où son entrée dans `.gitignore`.
 *
 * Ce script écrit dans PostHog, pas dans la base : il ne modifie aucun compte.
 * Une adresse inconnue est signalée et sautée, ce qui sert au passage à
 * repérer les fautes de frappe dans la liste d'invitation.
 */

import { readFileSync } from 'node:fs'

import { PrismaClient } from '@prisma/client'
import { PostHog } from 'posthog-node'

const prisma = new PrismaClient()

function readEmails(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
}

async function main() {
  const [path, ...rest] = process.argv.slice(2)
  const revoke = rest.includes('--revoke')

  if (!path) {
    console.error('Usage : pnpm --filter web posthog:testers <fichier> [--revoke]')
    process.exitCode = 1
    return
  }

  const key = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) {
    console.error('POSTHOG_KEY absente : rien à faire.')
    process.exitCode = 1
    return
  }

  const emails = readEmails(path)
  if (emails.length === 0) {
    console.error(`${path} ne contient aucune adresse.`)
    process.exitCode = 1
    return
  }

  const posthog = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  })

  let marked = 0
  const missing: string[] = []

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })

    if (!user) {
      missing.push(email)
      continue
    }

    posthog.identify({ distinctId: user.id, properties: { is_tester_ff: !revoke } })
    marked += 1
  }

  // Un script n'a ni `waitUntil` ni requête suivante pour emporter le reste :
  // sans cette fermeture, le process sortirait avec la file encore pleine.
  await posthog.shutdown()

  console.log(`${marked} compte(s) marqué(s) is_tester_ff=${!revoke}.`)
  if (missing.length > 0) {
    console.warn(
      `${missing.length} adresse(s) sans compte — invitation non honorée, ou faute de frappe :`,
    )
    for (const email of missing) console.warn(`  ${email}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
