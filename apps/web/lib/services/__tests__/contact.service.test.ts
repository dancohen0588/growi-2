import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  contactMessage: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  contactReply: { create: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { isMailConfigured, reply, setInternalNote, setStatus, subjectLabel } = await import(
  '../contact.service'
)
const { ServiceError } = await import('@/lib/services/errors')

const MESSAGE = {
  id: 'cm_1',
  email: 'sophie@exemple.fr',
  subject: 'technique',
  otherSubject: null,
  body: 'Mon basilic fait grise mine.',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_API_KEY', 're_test_key')
  send.mockResolvedValue({ data: { id: 'provider_1' }, error: null })
  prismaMock.contactMessage.findUnique.mockResolvedValue(MESSAGE)
  prismaMock.contactMessage.count.mockResolvedValue(1)
  prismaMock.contactReply.create.mockResolvedValue({ id: 'cr_1' })
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops.map(() => ({ id: 'cr_1' })))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'AUCUNE_ERREUR'
  } catch (err) {
    return err instanceof ServiceError ? err.code : 'AUTRE_ERREUR'
  }
}

describe('subjectLabel', () => {
  it('retire l’emoji du libellé', () => {
    expect(subjectLabel('technique')).toBe('Problème technique')
  })

  it('prend la précision quand le sujet est « autre »', () => {
    expect(subjectLabel('autre', 'Une idée')).toBe('Une idée')
    expect(subjectLabel('autre', '  ')).toBe('Autre')
  })

  it('tient un message sans sujet — la bêta iOS n’en a pas', () => {
    expect(subjectLabel(null)).toBe('Sans sujet')
  })
})

describe('isMailConfigured', () => {
  it('suit la présence de la clé', () => {
    expect(isMailConfigured()).toBe(true)
    vi.stubEnv('RESEND_API_KEY', '')
    expect(isMailConfigured()).toBe(false)
  })
})

describe('reply', () => {
  it('envoie l’email, enregistre la réponse et passe le message à « répondu »', async () => {
    const result = await reply({ messageId: 'cm_1', authorId: 'admin_1', body: 'Bonjour Sophie…' })

    expect(send.mock.calls[0][0]).toMatchObject({
      to: 'sophie@exemple.fr',
      replyTo: 'info@growi-garden.fr',
      subject: 'Re: Problème technique',
    })
    expect(result.providerId).toBe('provider_1')

    // Écriture de la réponse et changement de statut dans la même transaction.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.contactReply.create).toHaveBeenCalledWith({
      data: {
        messageId: 'cm_1',
        authorId: 'admin_1',
        body: 'Bonjour Sophie…',
        providerId: 'provider_1',
      },
    })
    expect(prismaMock.contactMessage.update).toHaveBeenCalledWith({
      where: { id: 'cm_1' },
      data: { status: 'answered' },
    })
  })

  it('cite le message d’origine sous la réponse', async () => {
    // Les en-têtes In-Reply-To / References ne sont pas disponibles : ce qu'on
    // répond n'était pas un email. Sans la citation, le destinataire reçoit
    // une réponse sans savoir à quoi.
    await reply({ messageId: 'cm_1', authorId: 'admin_1', body: 'Voici la marche à suivre.' })

    const { html } = send.mock.calls[0][0]
    expect(html).toContain('Voici la marche à suivre.')
    expect(html).toContain('Mon basilic fait grise mine.')
    expect(html).toContain('L’équipe Growi')
  })

  it('échappe le HTML de la réponse comme du message cité', async () => {
    prismaMock.contactMessage.findUnique.mockResolvedValue({
      ...MESSAGE,
      body: '<img src=x onerror=alert(1)>',
    })

    await reply({ messageId: 'cm_1', authorId: 'admin_1', body: '<b>gras</b>' })

    const { html } = send.mock.calls[0][0]
    expect(html).not.toContain('<b>gras</b>')
    expect(html).not.toContain('onerror=alert(1)>')
    expect(html).toContain('&lt;b&gt;gras&lt;/b&gt;')
  })

  it('n’écrit rien si l’email ne part pas', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'x' } })

    expect(
      await codeOf(reply({ messageId: 'cm_1', authorId: 'admin_1', body: 'Bonjour' })),
    ).toBe('UNAVAILABLE')

    // L'ordre compte : écrire d'abord afficherait une réponse envoyée alors
    // qu'elle ne l'est pas, sans aucun moyen de s'en apercevoir.
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('refuse de répondre sans clé Resend', async () => {
    vi.stubEnv('RESEND_API_KEY', '')

    expect(
      await codeOf(reply({ messageId: 'cm_1', authorId: 'admin_1', body: 'Bonjour' })),
    ).toBe('UNAVAILABLE')
    expect(send).not.toHaveBeenCalled()
  })

  it('refuse un message introuvable', async () => {
    prismaMock.contactMessage.findUnique.mockResolvedValue(null)

    expect(
      await codeOf(reply({ messageId: 'inconnu', authorId: 'admin_1', body: 'Bonjour' })),
    ).toBe('NOT_FOUND')
    expect(send).not.toHaveBeenCalled()
  })
})

describe('setStatus / setInternalNote', () => {
  it('change le statut', async () => {
    await setStatus('cm_1', 'archived')
    expect(prismaMock.contactMessage.update).toHaveBeenCalledWith({
      where: { id: 'cm_1' },
      data: { status: 'archived' },
    })
  })

  it('vide la note quand elle ne contient que des espaces', async () => {
    await setInternalNote('cm_1', '   ')
    expect(prismaMock.contactMessage.update).toHaveBeenCalledWith({
      where: { id: 'cm_1' },
      data: { internalNote: null },
    })
  })

  it('refuse un message introuvable', async () => {
    prismaMock.contactMessage.count.mockResolvedValue(0)
    expect(await codeOf(setStatus('inconnu', 'archived'))).toBe('NOT_FOUND')
    expect(await codeOf(setInternalNote('inconnu', 'note'))).toBe('NOT_FOUND')
  })
})
