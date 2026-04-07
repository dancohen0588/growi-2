// app/dashboard/plantes/layout.tsx
import type { ReactNode } from 'react'
import { PlantsProvider } from '@/lib/plants-context'
import { ToastProvider } from '@/components/ui/toast'

export default function PlantesLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PlantsProvider>
        {children}
      </PlantsProvider>
    </ToastProvider>
  )
}
