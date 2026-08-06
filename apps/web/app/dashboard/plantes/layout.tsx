import { PlantsProvider } from '@/lib/plants-context'
import { getUserPlants } from '@/lib/actions/plant.actions'
import { ToastProvider } from '@/components/ui/toast'

export default async function PlantesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const plants = await getUserPlants()

  return (
    <ToastProvider>
      <PlantsProvider initialPlants={plants}>
        {children}
      </PlantsProvider>
    </ToastProvider>
  )
}
