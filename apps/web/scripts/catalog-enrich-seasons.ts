/**
 * Complète le calendrier d'entretien des fiches du catalogue avec Gemini —
 * dormance, floraison, mise en place au jardin, taille, fertilisation,
 * traitement, protection d'hiver, paillage. Voir `lib/catalog/season-enrichment.ts`.
 *
 *   pnpm --filter web catalog:seasons                      # 25 fiches, à blanc
 *   pnpm --filter web catalog:seasons --limit 200
 *   pnpm --filter web catalog:seasons --slug rosier
 *   pnpm --filter web catalog:seasons --apply              # écrit en base
 *
 * **À blanc par défaut** : rien n'est écrit, un rapport JSON
 * (`catalog-seasons-report.json`, ou `--out <fichier>`) liste ce qui serait
 * écrit, fiche par fiche, pour relecture. `--apply` écrit les mêmes valeurs.
 * Seuls les champs **vides** sont remplis : une fiche corrigée à la main n'est
 * jamais modifiée.
 *
 * Travaille sur la base pointée par `.env` — la production, en pratique.
 * Après `--apply`, les plannings se recalculent au plus tard six heures
 * après (cache de conseils).
 */

import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

/** Une fiche à la fois, avec une pause : le quota gratuit de Gemini est court. */
const PAUSE_MS = 1_200

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main() {
  const { prisma } = await import('@/lib/prisma')
  const { generateJson, requireGeminiKey } = await import('@/lib/services/gemini')
  const {
    SEASON_FIELDS,
    buildSeasonPrompt,
    mergeSeasonProposal,
    missingSeasonFields,
    parseSeasonProposal,
  } = await import('@/lib/catalog/season-enrichment')
  const { writeFileSync } = await import('node:fs')

  const apply = process.argv.includes('--apply')
  const slug = argument('--slug')
  const limit = Number(argument('--limit') ?? 25)
  const out = argument('--out') ?? 'catalog-seasons-report.json'
  const apiKey = requireGeminiKey('GEMINI_API_KEY manquante dans .env')

  try {
    const plants = await prisma.plantCatalog.findMany({
      where: slug
        ? { slug }
        : {
            OR: SEASON_FIELDS.filter((field) => field !== 'mulchRecommended').map((field) => ({
              [field]: null,
            })),
          },
      orderBy: { commonName: 'asc' },
      take: slug ? undefined : limit,
    })

    console.log(`${plants.length} fiche(s) à examiner — ${apply ? 'ÉCRITURE en base' : 'à blanc'}\n`)

    const report: Array<Record<string, unknown>> = []
    let written = 0

    for (const plant of plants) {
      const missing = missingSeasonFields(plant)
      if (missing.length === 0) continue

      const result = await generateJson([{ text: buildSeasonPrompt(plant) }], {
        apiKey,
        maxOutputTokens: 1_000,
        logLabel: 'catalog-seasons',
      })
      if (!result.ok) {
        console.warn(`✗ ${plant.commonName} : ${result.reason}`)
        report.push({ slug: plant.slug, commonName: plant.commonName, error: result.reason })
        if (result.cause === 'quota') break
        continue
      }

      const proposal = parseSeasonProposal(result.raw)
      if (!proposal) {
        console.warn(`✗ ${plant.commonName} : réponse hors format`)
        report.push({ slug: plant.slug, commonName: plant.commonName, error: 'hors format', raw: result.raw })
        continue
      }

      const update = mergeSeasonProposal(plant, proposal)
      const fields = Object.keys(update)
      console.log(`${fields.length ? '•' : '·'} ${plant.commonName} — ${fields.join(', ') || 'rien à ajouter'}`)
      report.push({ slug: plant.slug, commonName: plant.commonName, scientificName: plant.scientificName, update })

      if (apply && fields.length > 0) {
        await prisma.plantCatalog.update({ where: { id: plant.id }, data: update })
        written += 1
      }

      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
    }

    writeFileSync(out, JSON.stringify(report, null, 2))
    console.log(`\nRapport : ${out}`)
    console.log(apply ? `${written} fiche(s) mises à jour.` : 'Rien n’a été écrit (ajouter --apply).')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
