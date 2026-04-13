'use client'

import type { ReactNode } from 'react'
import { PlantsProvider } from '@/lib/plants-context'
import { ToastProvider } from '@/components/ui/toast'
import type { Plant } from '@/lib/plant-types'

interface DashboardProvidersProps {
  children: ReactNode
  initialPlants?: Plant[]
}

export function DashboardProviders({ children, initialPlants = [] }: DashboardProvidersProps) {
  return (
    <ToastProvider>
      <PlantsProvider initialPlants={initialPlants}>
        {children}
      </PlantsProvider>
    </ToastProvider>
  )
}
