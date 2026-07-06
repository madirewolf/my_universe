import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const SITE_TITLE = "Mohammad's Universe (:"
const SITE_DESCRIPTION =
  'Mohammad Abu Daqer — computer engineer. An interactive 3D solar-system portfolio: every planet a discipline, every moon a project. Robotics, applied AI, silicon bring-up, and the inner universe behind it all.'

export const metadata: Metadata = {
  // Netlify exposes the canonical deploy URL as `URL` at build time; local
  // builds fall back to localhost so OG tags always resolve to absolute URLs.
  metadataBase: new URL(process.env.URL ?? 'http://localhost:3000'),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  authors: [{ name: 'Mohammad Abu Daqer' }],
  keywords: [
    'Mohammad Abu Daqer',
    'portfolio',
    'computer engineer',
    'robotics',
    'applied AI',
    'three.js',
    'interactive portfolio',
  ],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Mohammad's Universe",
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: "Mohammad's Universe — interactive solar-system portfolio" }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#05070d',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {/* Fonts are self-hosted via @font-face in globals.css:
            Gravitor (headings) + Acthirey (body). */}
        {children}
        <Analytics />
      </body>
    </html>
  )
}
