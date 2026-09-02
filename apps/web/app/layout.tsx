import type { Metadata } from 'next'
import { Poppins, Raleway } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-raleway',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://growi-garden.fr'),
  title: {
    default: 'Growi — Ton assistant jardin intelligent',
    template: '%s | Growi',
  },
  description:
    "L'application qui t'aide à entretenir ton jardin, guidée par la météo et l'IA.",
  keywords: [
    'application jardinage',
    'entretien plantes',
    'diagnostic plante',
    'calendrier jardin',
  ],
  openGraph: {
    type:     'website',
    locale:   'fr_FR',
    siteName: 'Growi',
  },
  twitter: { card: 'summary_large_image' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${poppins.variable} ${raleway.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
