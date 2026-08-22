import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ContactFormData } from '@/lib/schemas/contact-schema'

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

const { sendContactEmail } = await import('../contact')

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
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sendContactEmail', () => {
  it('envoie le message quand tout est en place', async () => {
    const result = await sendContactEmail(form())

    expect(result).toEqual({ success: true })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      to: 'contact@growi.app',
      replyTo: 'sophie@exemple.fr',
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

  it('répond poliment quand la clé Resend manque, sans lever', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('RESEND_API_KEY', '')

    const result = await sendContactEmail(form())

    // Une configuration absente n'est pas la faute du visiteur : il repart
    // avec une adresse où écrire, pas avec une erreur de Server Action.
    expect(result.success).toBe(false)
    expect(result.error).toContain('contact@growi.app')
    expect(send).not.toHaveBeenCalled()
    consoleError.mockRestore()
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

  it('refuse un formulaire invalide sans appeler Resend', async () => {
    const result = await sendContactEmail(form({ message: 'trop court' }))

    expect(result).toEqual({ success: false, error: 'Données invalides.' })
    expect(send).not.toHaveBeenCalled()
  })
})
