'use server'

/**
 * Formulaire de contact et liste d'attente bêta iOS.
 *
 * Ces actions ne font plus que valider et déléguer : la réception vit dans
 * `lib/services/contact.service.ts`.
 *
 * **Le message est écrit avant d'être notifié.** Le visiteur ne voit donc un
 * échec que si l'écriture rate — un refus de Resend ne lui concerne plus, son
 * message est arrivé et l'équipe le verra dans l'admin. C'est le changement de
 * comportement le plus visible de cette phase : auparavant, une clé Resend
 * absente perdait le message *et* affichait une erreur.
 */

import { z } from 'zod'

import { contactSchema, type ContactFormData } from '@/lib/schemas/contact-schema'
import { receive } from '@/lib/services/contact.service'
import { isServiceError } from '@/lib/services/errors'

const GENERIC_ERROR = 'Une erreur est survenue. Réessaie dans quelques instants.'

export async function sendContactEmail(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Données invalides.' }
  }

  const { firstName, lastName, email, phone, subject, otherSubject, message } = parsed.data

  try {
    await receive({
      source: 'contact',
      firstName,
      lastName,
      email,
      phone,
      subject,
      otherSubject,
      body: message,
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: isServiceError(err) ? err.message : GENERIC_ERROR }
  }
}

/**
 * Liste d'attente de la bêta iPhone, depuis le CTA final de la home.
 *
 * Elle n'emprunte pas `contactSchema`, qui exige un nom, un sujet et vingt
 * caractères de message : les inventer pour faire passer une adresse seule
 * écrirait de faux messages dans la boîte. Elle a sa propre source, et la
 * liste devient enfin exportable.
 */
export async function subscribeToIosBeta(email: string) {
  const parsed = z.string().trim().email().safeParse(email)
  if (!parsed.success) {
    return { success: false, error: 'Adresse e-mail invalide.' }
  }

  try {
    await receive({
      source: 'beta_ios',
      email: parsed.data,
      body: 'Inscription à la liste d’attente de la bêta iOS.',
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: isServiceError(err) ? err.message : GENERIC_ERROR }
  }
}
