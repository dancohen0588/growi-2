'use server'

import { Resend } from 'resend'
import { contactSchema, type ContactFormData, CONTACT_SUBJECTS } from '@/lib/schemas/contact-schema'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendContactEmail(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Données invalides.' }
  }

  const { firstName, lastName, email, phone, subject, otherSubject, message } = parsed.data
  const subjectEntry = CONTACT_SUBJECTS.find(s => s.value === subject)
  const subjectLabel = subject === 'autre'
    ? (otherSubject ?? 'Autre')
    : (subjectEntry?.label.replace(/^[^\s]+ /, '') ?? subject)

  try {
    await resend.emails.send({
      from:    'Growi Contact <contact@growi.app>',
      to:      'contact@growi.app',
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
              <td style="padding: 8px 0;">${firstName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Nom</td>
              <td style="padding: 8px 0;">${lastName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #1E5631;">${email}</a></td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Téléphone</td>
              <td style="padding: 8px 0;">${phone}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; font-weight: 600;">Sujet</td>
              <td style="padding: 8px 0;">${subjectLabel}</td>
            </tr>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #F9F7E8; border-radius: 8px; border-left: 4px solid #B4DD7F;">
            <p style="margin: 0; white-space: pre-line;">${message}</p>
          </div>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    console.error('Resend error:', err)
    return { success: false, error: 'Une erreur est survenue. Réessaie dans quelques instants.' }
  }
}
