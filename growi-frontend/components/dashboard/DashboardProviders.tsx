'use client'

import type { ReactNode } from 'react'
import { PlantsProvider } from '@/lib/plants-context'
import { ToastProvider } from '@/components/ui/toast'

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <PlantsProvider>
        {children}
      </PlantsProvider>
    </ToastProvider>
  )
}
