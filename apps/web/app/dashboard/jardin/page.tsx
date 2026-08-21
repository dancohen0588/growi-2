import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { GardenCanvasSkeleton } from '@/components/dashboard/jardin/GardenCanvasSkeleton'

export const metadata: Metadata = {
  title: 'Mon jardin',
}

const GardenCanvas = dynamic(
  () => import('@/components/dashboard/jardin/GardenCanvas').then(m => ({ default: m.GardenCanvas })),
  { ssr: false, loading: () => <GardenCanvasSkeleton /> },
)

export default function JardinPage() {
  return (
    // Cancel the p-6 padding from dashboard layout so canvas fills viewport
    <div className="-m-6 -mb-24 md:-mb-6 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <GardenCanvas />
    </div>
  )
}
