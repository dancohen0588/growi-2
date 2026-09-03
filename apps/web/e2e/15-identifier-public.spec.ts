import { createHash } from 'node:crypto'

import { test, expect } from '@playwright/test'
import { prisma } from './fixtures'

/**
 * La page `/identifier` est publique : ces tests ne se connectent jamais.
 *
 * Le parcours complet (photo → espèce reconnue) n'est pas joué : il appelle
 * Gemini, dont la réponse dépend du réseau, d'un quota et d'un modèle qui
 * évolue. Ce qu'on vérifie ici est ce qui doit tenir sans lui : la page est
 * atteignable sans compte, elle est indexable, elle mène à l'inscription, et
 * le plafond anonyme refuse au-delà de cinq identifications par jour.
 *
 * Chaque test utilise une adresse de la plage de documentation TEST-NET-3
 * (RFC 5737) qui lui est propre : les seaux sont indépendants, et l'ordre
 * d'exécution n'a pas d'importance.
 */

/** Un PNG 1×1 valide : il passe la validation d'image sans être une plante. */
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const QUOTA_IP = '203.0.113.42'

test.describe('Identification publique', () => {
  test.afterAll(async () => {
    // Les lignes de quota semées par ces tests ne doivent pas peser sur la
    // prochaine exécution du même jour.
    await prisma.identifyQuota.deleteMany({
      where: { day: new Date().toISOString().slice(0, 10) },
    })
  })

  test('E2E-IDENT-01 — La page est accessible sans compte et indexable', async ({ page }) => {
    // Le serveur e2e tourne en mode développement : la toute première
    // navigation vers une route déclenche sa compilation, qui dépasse les
    // 30 s par défaut. Ce n'est pas la page qui est lente, c'est le build.
    test.slow()
    await page.goto('/identifier')

    // Pas de redirection vers le login : c'est tout l'objet de la page.
    await expect(page).toHaveURL(/\/identifier$/)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Identifier une plante en photo',
    )
    await expect(page.getByRole('button', { name: /Prendre une photo/i })).toBeVisible()

    // Header et footer marketing, comme l'encyclopédie.
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/identifier$/,
    )
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('E2E-IDENT-02 — Le teaser de la home y mène, et la page mène à l’inscription', async ({
    page,
  }) => {
    test.slow() // Même raison : compilation de `/` et de `/register` en dev.
    await page.goto('/')
    await page.getByRole('link', { name: /Identifie une plante en photo/i }).click()
    await expect(page).toHaveURL(/\/identifier$/)

    // Le CTA de résultat n'apparaît qu'après une identification ; ce qui est
    // vérifiable sans Gemini, c'est que l'inscription reste à un clic.
    await page.goto('/register?plant=basilic')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Crée ton compte')
  })

  test('E2E-IDENT-03 — Le plafond anonyme refuse la sixième identification du jour', async ({
    request,
  }) => {
    // Le compteur est amené à sa limite en base plutôt qu'en épuisant les cinq
    // appels : chacun d'eux irait chez Gemini, qui est lent, facturé, et dont
    // la réponse n'a aucun intérêt ici. Le refus, lui, précède l'appel.
    await seedQuota(QUOTA_IP, 5)

    const refused = await request.post('/api/identify-plant', {
      headers: { 'x-forwarded-for': QUOTA_IP },
      data: { imageBase64: PIXEL },
    })

    expect(refused.status()).toBe(429)
    expect((await refused.json()).error).toBe('Crée ton jardin pour continuer')
  })

  test('E2E-IDENT-04 — Une image invalide ne consomme pas de crédit', async ({ request }) => {
    const ip = '203.0.113.77'

    // Six refus de forme. Ils n'atteignent pas Gemini et ne doivent donc rien
    // coûter : si le décompte les comptait, le sixième répondrait 429 et une
    // ligne apparaîtrait en base.
    for (let i = 1; i <= 6; i++) {
      const res = await request.post('/api/identify-plant', {
        headers: { 'x-forwarded-for': ip },
        data: { imageBase64: 'pas-une-image' },
      })
      expect(res.status(), `refus de forme ${i}`).toBe(400)
    }

    expect(await quotaCount(ip)).toBe(0)
  })
})

// ─── Accès direct au compteur ──────────────────────────────────────────────
// Le service pseudonymise l'adresse avant de l'écrire ; les tests refont le
// même calcul plutôt que de l'importer, pour que changer l'un fasse échouer
// l'autre au lieu de le suivre en silence.

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function hash(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

async function seedQuota(ip: string, count: number): Promise<void> {
  const where = { ipHash_day: { ipHash: hash(ip), day: today() } }
  await prisma.identifyQuota.upsert({
    where,
    create: { ipHash: hash(ip), day: today(), count },
    update: { count },
  })
}

async function quotaCount(ip: string): Promise<number> {
  const row = await prisma.identifyQuota.findUnique({
    where: { ipHash_day: { ipHash: hash(ip), day: today() } },
  })
  return row?.count ?? 0
}
