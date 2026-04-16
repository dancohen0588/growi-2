import * as fs from 'fs'
import * as path from 'path'

// Load .env BEFORE PrismaClient is instantiated
const envPath = path.join(__dirname, '..', '.env')
const envContent = fs.readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  if (m) {
    const key = m[1]
    const val = m[2].replace(/^"(.*)"$/, '$1')
    process.env[key] = val
  }
}

// Override to use direct URL (bypasses pgbouncer pooler)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'quentin@gmail.com' },
    select: { id: true, email: true, firstName: true, latitude: true, longitude: true, onboarded: true },
  })

  console.log('\n=== USER ===')
  console.log(JSON.stringify(user, null, 2))

  if (!user) { console.log('USER NOT FOUND'); return }

  const gardens = await prisma.garden.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, type: true, createdAt: true },
  })

  console.log('\n=== GARDENS ===')
  console.log(JSON.stringify(gardens, null, 2))

  if (gardens.length === 0) { console.log('NO GARDENS'); return }

  const gardenId = gardens[0].id

  // instances by gardenId (what the engine sees)
  const byGarden = await prisma.plantInstance.findMany({
    where: { gardenId },
    select: { id: true, customName: true, catalogPlantId: true, wateringFreqDays: true, lastWateredAt: true, gardenId: true },
  })
  console.log(`\n=== PLANT INSTANCES (by gardenId=${gardenId}) ===`)
  console.log(JSON.stringify(byGarden, null, 2))

  // instances by userId (all plants this user has)
  const byUser = await prisma.plantInstance.findMany({
    where: { userId: user.id },
    select: { id: true, customName: true, catalogPlantId: true, wateringFreqDays: true, lastWateredAt: true, gardenId: true },
  })
  console.log(`\n=== PLANT INSTANCES (by userId) ===`)
  console.log(JSON.stringify(byUser, null, 2))

  // catalog for each instance
  for (const inst of byUser) {
    if (inst.catalogPlantId) {
      const cat = await prisma.plantCatalog.findUnique({
        where: { id: inst.catalogPlantId },
        select: { id: true, commonName: true, wateringFreqDays: true },
      })
      console.log(`\nCATALOG for [${inst.id}] "${inst.customName ?? 'unnamed'}": ${JSON.stringify(cat)}`)
    } else {
      console.log(`\nNO CATALOG for [${inst.id}] "${inst.customName ?? 'unnamed'}" | instance.wateringFreqDays=${inst.wateringFreqDays}`)
    }
  }

  // cache
  const cache = await prisma.gardenAdviceCache.findUnique({
    where: { gardenId },
    select: { gardenId: true, generatedAt: true, expiresAt: true },
  })
  console.log('\n=== GARDEN ADVICE CACHE ===')
  console.log(JSON.stringify(cache, null, 2))
  if (cache) {
    const now = new Date()
    console.log(`Cache still valid? ${cache.expiresAt > now} | expires ${cache.expiresAt.toISOString()} | now ${now.toISOString()}`)
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
