import type { Metadata } from 'next'
import { Poppins, Raleway } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

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
  metadataBase: new URL('https://growi.app'),
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
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
