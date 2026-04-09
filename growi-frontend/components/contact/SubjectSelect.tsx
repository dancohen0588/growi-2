'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { NativeSelect as Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CONTACT_SUBJECTS } from '@/lib/schemas/contact-schema'
import { cn } from '@/lib/utils'
import type { UseFormRegister, FieldErrors } from 'react-hook-form'
import type { ContactFormData } from '@/lib/schemas/contact-schema'

interface SubjectSelectProps {
  register: UseFormRegister<ContactFormData>
  errors: FieldErrors<ContactFormData>
  watchedSubject: string
}

export function SubjectSelect({ register, errors, watchedSubject }: SubjectSelectProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="subject">Sujet *</Label>
        <Select
          id="subject"
          aria-invalid={!!errors.subject}
          className={cn(errors.subject && 'border-destructive focus-visible:ring-destructive')}
          {...register('subject')}
        >
          <option value="" disabled>Choisis un sujet...</option>
          {CONTACT_SUBJECTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        {errors.subject && (
          <p className="text-destructive text-sm mt-1">{errors.subject.message}</p>
        )}
      </div>

      <AnimatePresence>
        {watchedSubject === 'autre' && (
          <motion.div
            key="other-subject"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Label htmlFor="otherSubject">Précise ton sujet *</Label>
            <Input
              id="otherSubject"
              type="text"
              placeholder="Dis-nous en plus..."
              aria-invalid={!!errors.otherSubject}
              className={cn(errors.otherSubject && 'border-destructive focus-visible:ring-destructive')}
              {...register('otherSubject')}
            />
            {errors.otherSubject && (
              <p className="text-destructive text-sm mt-1">{errors.otherSubject.message}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
