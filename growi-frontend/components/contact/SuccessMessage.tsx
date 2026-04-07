'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function SuccessMessage() {
  const router = useRouter()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col items-center text-center gap-4 py-14"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
        className="text-6xl"
        aria-hidden
      >
        🌱
      </motion.div>

      <div className="space-y-2">
        <h3 className="font-poppins font-semibold text-forest text-2xl">
          Message envoyé !
        </h3>
        <p className="text-muted-foreground font-raleway max-w-sm leading-relaxed">
          On a bien reçu ton message. On te répond sous 48h — en attendant, profite de ton jardin !
        </p>
      </div>

      <Button
        variant="outline"
        onClick={() => router.push('/')}
        className="mt-2"
      >
        Retour à l&apos;accueil
      </Button>
    </motion.div>
  )
}
