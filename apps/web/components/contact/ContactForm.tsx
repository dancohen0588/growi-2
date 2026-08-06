'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'

import { contactSchema, type ContactFormData } from '@/lib/schemas/contact-schema'
import { sendContactEmail } from '@/app/actions/contact'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubjectSelect } from './SubjectSelect'
import { SuccessMessage } from './SuccessMessage'
import { cn } from '@/lib/utils'

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: 'onBlur',
  })

  const watchedSubject = watch('subject') ?? ''

  async function onSubmit(data: ContactFormData) {
    const result = await sendContactEmail(data)
    if (result.success) {
      setSubmitted(true)
    } else {
      toast.error(result.error ?? 'Une erreur est survenue. Réessaie dans quelques instants.')
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6 md:p-8">
      <AnimatePresence mode="wait">
        {submitted ? (
          <SuccessMessage key="success" />
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
          >
            {/* Prénom + Nom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Sophie"
                  autoComplete="given-name"
                  aria-invalid={!!errors.firstName}
                  className={cn(
                    errors.firstName && 'border-destructive focus-visible:ring-destructive',
                    !errors.firstName && watch('firstName') && watch('firstName').length >= 2 && 'border-lime',
                  )}
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-destructive text-sm mt-1" role="alert">{errors.firstName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Dupont"
                  autoComplete="family-name"
                  aria-invalid={!!errors.lastName}
                  className={cn(
                    errors.lastName && 'border-destructive focus-visible:ring-destructive',
                    !errors.lastName && watch('lastName') && watch('lastName').length >= 2 && 'border-lime',
                  )}
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="text-destructive text-sm mt-1" role="alert">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            {/* Email + Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="sophie@exemple.fr"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  className={cn(
                    errors.email && 'border-destructive focus-visible:ring-destructive',
                    !errors.email && watch('email') && watch('email').includes('@') && 'border-lime',
                  )}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-destructive text-sm mt-1" role="alert">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Téléphone <span className="text-forest/40 font-normal">(optionnel)</span></Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  autoComplete="tel"
                  {...register('phone')}
                />
              </div>
            </div>

            {/* Sujet */}
            <SubjectSelect
              register={register}
              errors={errors}
              watchedSubject={watchedSubject}
            />

            {/* Message */}
            <div>
              <Label htmlFor="message">
                Message *{' '}
                {watch('message') && (
                  <span className={cn(
                    'font-normal text-xs',
                    watch('message').length < 20 ? 'text-forest/40' : 'text-lime',
                  )}>
                    ({watch('message').length} / 20 min)
                  </span>
                )}
              </Label>
              <Textarea
                id="message"
                placeholder="Dis-nous ce qu'on peut faire pour toi..."
                aria-invalid={!!errors.message}
                className={cn(
                  'min-h-[140px] resize-none',
                  errors.message && 'border-destructive focus-visible:ring-destructive',
                  !errors.message && watch('message') && watch('message').length >= 20 && 'border-lime',
                )}
                {...register('message')}
              />
              {errors.message && (
                <p className="text-destructive text-sm mt-1" role="alert">{errors.message.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="w-full hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? 'Envoi en cours...' : 'Envoyer mon message 🌱'}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
