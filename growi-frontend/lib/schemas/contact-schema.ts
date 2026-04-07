import { z } from 'zod'

export const CONTACT_SUBJECTS = [
  { value: 'diagnostic',  label: '🌿 Diagnostic de mes plantes' },
  { value: 'compte',      label: '👤 Mon compte & abonnement' },
  { value: 'technique',   label: '🔧 Problème technique' },
  { value: 'suggestion',  label: '💡 Suggestion ou retour produit' },
  { value: 'partenariat', label: '🤝 Partenariat ou presse' },
  { value: 'autre',       label: '✏️ Autre' },
] as const

export type SubjectValue = typeof CONTACT_SUBJECTS[number]['value']

export const contactSchema = z.object({
  firstName:    z.string().min(2, 'Prénom trop court'),
  lastName:     z.string().min(2, 'Nom trop court'),
  email:        z.string().email('Email invalide'),
  phone:        z.string().optional(),
  subject:      z.enum(['diagnostic', 'compte', 'technique', 'suggestion', 'partenariat', 'autre']),
  otherSubject: z.string().optional(),
  message:      z.string().min(20, 'Message trop court (min. 20 caractères)'),
}).refine(
  (data) => data.subject !== 'autre' || (!!data.otherSubject && data.otherSubject.length >= 3),
  { message: 'Précise ton sujet', path: ['otherSubject'] },
)

export type ContactFormData = z.infer<typeof contactSchema>
