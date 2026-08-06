import type { Metadata } from 'next'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { EncyclopedieClient, type EncyclopediaPlant } from './_components/EncyclopedieClient'

export const revalidate = 86400 // ISR: 24h

export const metadata: Metadata = {
  title: 'Encyclopédie des plantes — Growi',
  description:
    "Explore plus de 527 plantes de jardin et d'intérieur : guide d'entretien, arrosage, exposition, toxicité. Une encyclopédie gratuite et complète signée Growi.",
  alternates: { canonical: '/encyclopedie' },
  openGraph: {
    title: 'Encyclopédie des plantes — Growi',
    description:
      "Explore plus de 527 plantes de jardin et d'intérieur. Conseils d'entretien, arrosage, exposition.",
    url: '/encyclopedie',
    type: 'website',
  },
}

// Cached full-catalog fetch, invalidated daily or via revalidateTag('catalog')
const getAllCatalogPlants = unstable_cache(
  async (): Promise<EncyclopediaPlant[]> => {
    const plants = await prisma.plantCatalog.findMany({
      where: { slug: { not: null } },
      select: {
        id: true, slug: true, commonName: true, scientificName: true,
        emoji: true, imageUrl: true, category: true,
        wateringFreqDays: true, wateringDifficulty: true, sunExposure: true,
        edible: true, toxic: true,
      },
      orderBy: { commonName: 'asc' },
    })
    // slug is guaranteed non-null by the where clause above
    return plants as EncyclopediaPlant[]
  },
  ['encyclopedie-all-plants'],
  { revalidate: 86400, tags: ['catalog'] },
)

export default async function EncyclopediePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const plants = await getAllCatalogPlants()

  // Serialize initial URL state for deep-linking. The client will mirror
  // subsequent changes via history.replaceState without a server round-trip.
  const initial = {
    category: singleParam(searchParams?.category) ?? 'all',
    sun:      singleParam(searchParams?.sun)      ?? 'all',
    q:        singleParam(searchParams?.q)        ?? '',
    letter:   singleParam(searchParams?.letter)   ?? '',
    sort:     singleParam(searchParams?.sort)     ?? 'name_asc',
    page:     Number(singleParam(searchParams?.page)) || 1,
  }

  return <EncyclopedieClient plants={plants} initial={initial} />
}

function singleParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}
