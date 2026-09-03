'use server'

import { Resend } from 'resend'
import { z } from 'zod'
import { contactSchema, type ContactFormData, CONTACT_SUBJECTS } from '@/lib/schemas/contact-schema'

/** Adresse de la boîte de contact, et repli proposé au visiteur si l'envoi échoue. */
const CONTACT_EMAIL = 'info@growi-garden.fr'

/**
 * Resend n'expédie que depuis un domaine vérifié chez lui. Tant que
 * `growi-garden.fr` ne l'est pas, `CONTACT_FROM_EMAIL` permet d'emprunter un
 * domaine qui l'est — sans quoi chaque envoi est refusé, clé valide ou non. Le
 * destinataire, lui, peut être n'importe quelle adresse : la vérification ne
 * porte que sur l'expéditeur.
 *
 * Lu à l'appel, jamais au chargement : une variable d'environnement ajoutée
 * après coup doit être prise en compte au redémarrage suivant, pas au prochain
 * déploiement.
 */
function addresses() {
  return {
    from: process.env.CONTACT_FROM_EMAIL ?? CONTACT_EMAIL,
    to: process.env.CONTACT_TO_EMAIL ?? CONTACT_EMAIL,
  }
}

const GENERIC_ERROR = 'Une erreur est survenue. Réessaie dans quelques instants.'
const NOT_CONFIGURED =
  `L'envoi de messages est momentanément indisponible. Écris-nous directement à ${CONTACT_EMAIL}.`

/**
 * Le constructeur de Resend lève quand la clé manque. Le convoquer à l'appel
 * plutôt qu'au chargement du module permet de répondre poliment : une
 * configuration absente n'est pas la faute du visiteur, et il ne doit pas
 * récolter une erreur brute de Server Action.
 */
function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

/**
 * Ce que le visiteur écrit finit dans un email HTML. Sans échappement, il
 * choisit la mise en forme de ce qu'on reçoit — et y glisse ce qu'il veut.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendContactEmail(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Données invalides.' }
  }

  const resend = getResendClient()
  if (!resend) {
    console.error('[contact] RESEND_API_KEY absente : le formulaire ne peut pas envoyer.')
    return { success: false, error: NOT_CONFIGURED }
  }

  const { firstName, lastName, email, phone, subject, otherSubject, message } = parsed.data
  const subjectEntry = CONTACT_SUBJECTS.find(s => s.value === subject)
  const subjectLabel = subject === 'autre'
    ? (otherSubject ?? 'Autre')
    : (subjectEntry?.label.replace(/^[^\s]+ /, '') ?? subject)

  const { from, to } = addresses()

  try {
    // Le SDK ne lève que sur une panne de transport. Un refus de l'API —
    // domaine d'expéditeur non vérifié, adresse malformée, quota — arrive dans
    // `error` avec une promesse tenue. L'ignorer afficherait « message envoyé »
    // alors que rien n'est parti.
    const result = await resend.emails.send({
      from:    `Growi Contact <${from}>`,
      to,
      replyTo: email,
      subject: `[Growi Contact] ${subjectLabel} — ${firstName} ${lastName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1E5631;">
          <h2 style="color: #1E5631; border-bottom: 2px solid #B4DD7F; padding-bottom: 12px;">
            Nouveau message de contact
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; width: 120px;">Prénom</td>
              <td style="padding: 8px 0;">${escapeHtml(firstName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Nom</td>
              <td style="padding: 8px 0;">${escapeHtml(lastName)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #1E5631;">${escapeHtml(email)}</a></td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Téléphone</td>
              <td style="padding: 8px 0;">${escapeHtml(phone)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Sujet</td>
              <td style="padding: 8px 0;">${escapeHtml(subjectLabel)}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #F9F7E8; border-radius: 8px; border-left: 4px solid #B4DD7F;">
            <p style="margin: 0; white-space: pre-line;">${escapeHtml(message)}</p>
          </div>
        </div>
      `,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: GENERIC_ERROR }
    }

    return { success: true }
  } catch (err) {
    console.error('Resend error:', err)
    return { success: false, error: GENERIC_ERROR }
  }
}

/**
 * Liste d'attente de la bêta iPhone, depuis le CTA final de la home.
 *
 * Elle emprunte la plomberie du formulaire de contact — même clé, même
 * expéditeur, même boîte — mais pas son schéma : celui-ci exige un nom, un
 * sujet et vingt caractères de message. Les inventer pour faire passer une
 * adresse e-mail seule reviendrait à écrire de faux messages dans la boîte.
 */
export async function subscribeToIosBeta(email: string) {
  const parsed = z.string().trim().email().safeParse(email)
  if (!parsed.success) {
    return { success: false, error: 'Adresse e-mail invalide.' }
  }

  const resend = getResendClient()
  if (!resend) {
    console.error('[beta-ios] RESEND_API_KEY absente : l\'inscription ne peut pas être envoyée.')
    return { success: false, error: NOT_CONFIGURED }
  }

  const { from, to } = addresses()
  const address = parsed.data

  try {
    const result = await resend.emails.send({
      from:    `Growi Bêta <${from}>`,
      to,
      replyTo: address,
      subject: 'Bêta iOS',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1E5631;">
          <h2 style="color: #1E5631; border-bottom: 2px solid #B4DD7F; padding-bottom: 12px;">
            Inscription à la bêta iOS
          </h2>
          <p><a href="mailto:${escapeHtml(address)}" style="color: #1E5631;">${escapeHtml(address)}</a></p>
        </div>
      `,
    })

    if (result.error) {
      console.error('Resend error:', result.error)
      return { success: false, error: GENERIC_ERROR }
    }

    return { success: true }
  } catch (err) {
    console.error('Resend error:', err)
    return { success: false, error: GENERIC_ERROR }
  }
}
