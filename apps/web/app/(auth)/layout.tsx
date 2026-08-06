// growi-frontend/app/(auth)/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-sand px-4 py-12">
      {children}
    </main>
  )
}
