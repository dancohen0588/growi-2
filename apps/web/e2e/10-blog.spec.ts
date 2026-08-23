import { test, expect } from '@playwright/test'

/**
 * Le blog est entièrement public : ces tests ne se connectent pas, et n'ont
 * donc pas de données à semer ni à nettoyer.
 *
 * L'invisibilité des brouillons en production n'est pas testée ici — le
 * serveur e2e tourne en mode développement, où ils sont volontairement
 * visibles. Ce comportement est couvert par `lib/__tests__/blog-content.test.ts`,
 * qui recharge le module avec `NODE_ENV=production`.
 */

test.describe('Blog', () => {
  test('E2E-BLOG-01 — /blog liste des articles', async ({ page }) => {
    await page.goto('/blog')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Le blog Growi')

    const cards = page.locator('article')
    expect(await cards.count()).toBeGreaterThan(0)

    // Chaque carte mène quelque part et annonce son temps de lecture.
    const first = cards.first()
    await expect(first.getByRole('link')).toHaveAttribute('href', /^\/blog\/[a-z0-9-]+$/)
    await expect(first).toContainText('min de lecture')
  })

  test('E2E-BLOG-02 — Une carte mène à son article, balisé pour le référencement', async ({
    page,
  }) => {
    await page.goto('/blog')
    const href = await page.locator('article').first().getByRole('link').getAttribute('href')

    await page.locator('article').first().getByRole('link').click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))

    // Le titre de l'article est le h1 de la page — un seul, comme il se doit.
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveCount(1)
    expect((await h1.textContent())?.trim().length).toBeGreaterThan(0)

    // Canonique et OpenGraph, en URL absolue.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`^https?://.+${href}$`),
    )
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')

    // JSON-LD : un Article et son fil d'Ariane.
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    const graph = JSON.parse(jsonLd ?? '{}')['@graph'] as Array<Record<string, unknown>>
    const article = graph.find((node) => node['@type'] === 'Article')

    expect(graph.map((node) => node['@type'])).toEqual(['Article', 'BreadcrumbList'])
    expect(article?.headline).toBe((await h1.textContent())?.trim())
    expect(article?.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(article?.author).toMatchObject({ '@type': 'Person' })
  })

  test('E2E-BLOG-03 — Le corps de l\'article est rendu, ancres comprises', async ({ page }) => {
    await page.goto('/blog')
    await page.locator('article').first().getByRole('link').click()

    const prose = page.locator('.article-prose')
    await expect(prose).toBeVisible()

    // rehype-slug : chaque intertitre porte une ancre partageable.
    const headings = prose.locator('h2[id]')
    expect(await headings.count()).toBeGreaterThan(0)

    // Le MDX est compilé : aucun composant ne doit rester en texte brut.
    await expect(prose).not.toContainText('<Callout')
  })

  test('E2E-BLOG-04 — Un slug inconnu répond 404', async ({ page }) => {
    const response = await page.goto('/blog/cet-article-n-existe-pas')
    expect(response?.status()).toBe(404)
  })

  test('E2E-BLOG-05 — Le filtre par thème ne garde que ses articles', async ({
    page,
    request,
  }) => {
    await page.goto('/blog')

    // La première pastille après « Tout ».
    const pill = page.getByRole('navigation', { name: 'Filtrer par thème' }).getByRole('link').nth(1)
    const label = (await pill.textContent())?.trim() ?? ''
    const tag = new URL(await pill.getAttribute('href') ?? '', 'http://x').searchParams.get('tag')

    await pill.click()
    await expect(page).toHaveURL(/\?tag=/)
    // Le titre devient celui du thème : la page filtrée est une page à part.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)

    const shown = await page.locator('article a[href^="/blog/"]').evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute('href')!.split('/').pop()),
    )
    expect(shown.length).toBeGreaterThan(0)

    // La page et l'API doivent voir exactement le même sous-ensemble : elles
    // lisent la même couche de contenu, une divergence signalerait un filtre
    // appliqué deux fois différemment.
    const { data } = await (await request.get(`/api/v1/blog?tag=${tag}&limit=50`)).json()
    expect(shown.sort()).toEqual(data.posts.map((p: { slug: string }) => p.slug).sort())
  })

  test('E2E-BLOG-06 — Un tag ou une page invalides ne cassent pas la liste', async ({ page }) => {
    for (const query of ['?tag=jardinage', '?page=0', '?page=999']) {
      const response = await page.goto(`/blog${query}`)
      expect(response?.status(), query).toBe(200)
      expect(await page.locator('article').count(), query).toBeGreaterThan(0)
    }
  })

  test('E2E-BLOG-07 — Les articles sont dans le sitemap', async ({ request, page }) => {
    await page.goto('/blog')
    const href = await page.locator('article').first().getByRole('link').getAttribute('href')

    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain(`${href}</loc>`)
  })
})

test.describe('API blog', () => {
  test('E2E-BLOG-API-01 — La liste répond sans authentification', async ({ request }) => {
    const response = await request.get('/api/v1/blog?limit=2')
    expect(response.status()).toBe(200)

    // Publique et identique pour tous : elle doit pouvoir vivre dans un CDN.
    expect(response.headers()['cache-control']).toContain('s-maxage')

    const { data } = await response.json()
    expect(data.posts.length).toBeGreaterThan(0)
    expect(data.pagination).toMatchObject({ page: 1 })
    // La liste reste légère : pas de contenu.
    expect(data.posts[0].html).toBeUndefined()
  })

  test('E2E-BLOG-API-02 — L\'article est servi en HTML aux URLs absolues', async ({ request }) => {
    const { data: list } = await (await request.get('/api/v1/blog?limit=1')).json()
    const slug = list.posts[0].slug

    const response = await request.get(`/api/v1/blog/${slug}`)
    expect(response.status()).toBe(200)

    const { data } = await response.json()
    expect(data.slug).toBe(slug)
    expect(data.html).toContain('<h2 id=')
    // Le mobile n'a pas de page courante pour résoudre un chemin relatif.
    expect(data.coverImage).toMatch(/^https?:\/\//)
    expect(data.html).not.toMatch(/\b(src|href)="\/(?!\/)/)
  })

  test('E2E-BLOG-API-03 — Slug inconnu et tag invalide sont distingués', async ({ request }) => {
    const notFound = await request.get('/api/v1/blog/cet-article-n-existe-pas')
    expect(notFound.status()).toBe(404)
    expect((await notFound.json()).error).toMatchObject({ code: 'NOT_FOUND' })

    const badTag = await request.get('/api/v1/blog?tag=jardinage')
    expect(badTag.status()).toBe(400)
    expect((await badTag.json()).error).toMatchObject({ code: 'INVALID_INPUT' })
  })
})
