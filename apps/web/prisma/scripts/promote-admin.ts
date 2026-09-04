/**
 * Amorçage : donne le rôle d'administrateur à un compte existant.
 *
 *   pnpm --filter web admin:promote dan0588@gmail.com
 *   pnpm --filter web admin:promote dan0588@gmail.com --revoke
 *
 * C'est la **seule** voie pour créer le premier administrateur : il n'existe
 * volontairement aucune règle « premier inscrit = admin », qui ferait dépendre
 * les droits de l'ordre des inscriptions. Ensuite, l'admin se gère depuis le
 * portail lui-même.
 *
 * Le script n'appelle pas `demoteAdmin` : celle-ci refuse le dernier
 * administrateur pour protéger le portail, alors qu'ici on répare précisément
 * les cas où le portail est déjà inaccessible.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const revoke = args.includes('--revoke')
  const email = args.find((arg) => !arg.startsWith('--'))?.trim().toLowerCase()

  if (!email) {
    console.error('Usage : pnpm --filter web admin:promote <email> [--revoke]')
    process.exitCode = 1
    return
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, disabledAt: true },
  })

  if (!user) {
    console.error(`Aucun compte avec l'adresse ${email}. Le compte doit exister au préalable.`)
    process.exitCode = 1
    return
  }

  if (!revoke && user.disabledAt) {
    console.error(`Le compte ${email} est désactivé : réactive-le avant de le promouvoir.`)
    process.exitCode = 1
    return
  }

  const role = revoke ? 'USER' : 'ADMIN'

  if (user.role === role) {
    console.log(`${email} a déjà le rôle ${role}. Rien à faire.`)
    return
  }

  await prisma.user.update({ where: { id: user.id }, data: { role } })
  console.log(`${email} : ${user.role} → ${role}.`)

  const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
  if (admins === 0) {
    console.warn('⚠️  Plus aucun administrateur : /admin est désormais inaccessible.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
