import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContactFormData } from '@/lib/schemas/contact-schema'

/**
 * Le formulaire de contact, de bout en bout : Server Action → service.
 *
 * La règle qui structure ces tests, et qui a changé avec la messagerie :
 * **le message est écrit avant d'être notifié**. Un refus de Resend — clé
 * absente, domaine non vérifié, quota — ne perd plus rien et n'est plus un
 * échec pour le visiteur. Seule une écriture ratée en est un.
 */

// Le vrai SDK lève quand la clé manque : le double le fait aussi, sinon le
// test le plus important de ce fichier ne prouverait rien.
const send = vi.hoisted(() => vi.fn())
vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
    constructor(key?: string) {
      if (!key) throw new Error('Missing API key.')
    }
  },
}))

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  contactMessage: { create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { sendContactEmail, subscribeToIosBeta } = await import('../contact')

function form(overrides: Partial<ContactFormData> = {}): ContactFormData {
  return {
    firstName: 'Sophie',
    lastName: 'Dupont',
    email: 'sophie@exemple.fr',
    subject: 'technique',
    message: 'Mon basilic fait grise mine depuis une semaine.',
    ...overrides,
  } as ContactFormData
}

beforeEach(() => {
  vi.clearAllMocks()
  send.mockResolvedValue({ data: { id: 'msg-1' }, error: null })
  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.contactMessage.create.mockResolvedValue({ id: 'cm_1' })
  prismaMock.contactMessage.update.mockResolvedValue({})
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendContactEmail', () => {
  it('enregistre le message et le notifie quand tout est en place', async () => {
    const result = await sendContactEmail(form())

    expect(result).toEqual({ success: true })
    expect(prismaMock.contactMessage.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.contactMessage.create.mock.calls[0][0].data).toMatchObject({
      source: 'contact',
      email: 'sophie@exemple.fr',
      body: 'Mon basilic fait grise mine depuis une semaine.',
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      to: 'info@growi-garden.fr',
      replyTo: 'sophie@exemple.fr',
    })

    // La notification partie, on l'inscrit — c'est ce qui distingue plus tard
    // un message reçu sans alerte d'un message annoncé.
    expect(prismaMock.contactMessage.update).toHaveBeenCalledWith({
      where: { id: 'cm_1' },
      data: { notifiedAt: expect.any(Date) },
    })
  })

  it('expédie depuis le domaine configuré, pas depuis un domaine non vérifié', async () => {
    // Resend refuse tout expéditeur dont le domaine n'est pas vérifié chez lui.
    vi.stubEnv('CONTACT_FROM_EMAIL', 'contact@dancohen.dev')
    vi.stubEnv('CONTACT_TO_EMAIL', 'dan@exemple.fr')

    await sendContactEmail(form())

    expect(send.mock.calls[0][0]).toMatchObject({
      from: 'Growi Contact <contact@dancohen.dev>',
      to: 'dan@exemple.fr',
    })
  })

  it('conserve le message quand Resend refuse la notification', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Le SDK tient sa promesse et met le refus dans `error` : c'est ainsi
    // qu'arrive un domaine d'expéditeur non vérifié.
    send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'x' } })

    const result = await sendContactEmail(form())

    // Le visiteur a écrit, son message est arrivé : lui annoncer un échec
    // l'inviterait à recommencer et créerait un doublon.
    expect(result).toEqual({ success: true })
    expect(prismaMock.contactMessage.create).toHaveBeenCalledTimes(1)
    // `notifiedAt` reste nul : l'admin voit que personne n'a été alerté.
    expect(prismaMock.contactMessage.update).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('conserve le message quand la clé Resend manque, sans lever', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('RESEND_API_KEY', '')

    const result = await sendContactEmail(form())

    expect(result).toEqual({ success: true })
    expect(prismaMock.contactMessage.create).toHaveBeenCalledTimes(1)
    expect(send).not.toHaveBeenCalled()
    expect(prismaMock.contactMessage.update).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('échoue — et le dit — quand l’écriture rate', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.contactMessage.create.mockRejectedValue(new Error('base injoignable'))

    const result = await sendContactEmail(form())

    // Le seul cas où le visiteur doit voir un échec : rien n'a été gardé.
    expect(result.success).toBe(false)
    expect(send).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('rattache le message au compte Growi, sans tenir compte de la casse', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user_1' })

    await sendContactEmail(form({ email: 'Sophie@Exemple.fr' }))

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'Sophie@Exemple.fr', mode: 'insensitive' } },
      select: { id: true },
    })
    expect(prismaMock.contactMessage.create.mock.calls[0][0].data.userId).toBe('user_1')
  })

  it('échappe le HTML de ce que le visiteur écrit', async () => {
    await sendContactEmail(
      form({ message: 'Regarde <script>alert(1)</script> & dis-moi.', lastName: '<b>Dupont</b>' }),
    )

    const { html } = send.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;b&gt;Dupont&lt;/b&gt;')
    expect(html).toContain('&amp; dis-moi')
  })

  it('refuse un formulaire invalide sans rien écrire ni envoyer', async () => {
    const result = await sendContactEmail(form({ message: 'trop court' }))

    expect(result).toEqual({ success: false, error: 'Données invalides.' })
    expect(prismaMock.contactMessage.create).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })
})

describe('subscribeToIosBeta', () => {
  it('enregistre l’inscription sous sa propre source', async () => {
    // La liste d'attente n'emprunte pas `contactSchema` : elle n'a ni nom, ni
    // sujet, ni message de vingt caractères à inventer.
    const result = await subscribeToIosBeta('  Nouveau@Exemple.fr ')

    expect(result).toEqual({ success: true })
    expect(prismaMock.contactMessage.create.mock.calls[0][0].data).toMatchObject({
      source: 'beta_ios',
      email: 'Nouveau@Exemple.fr',
      firstName: null,
      lastName: null,
    })
  })

  it('refuse une adresse invalide', async () => {
    const result = await subscribeToIosBeta('pas-une-adresse')

    expect(result.success).toBe(false)
    expect(prismaMock.contactMessage.create).not.toHaveBeenCalled()
  })
})
