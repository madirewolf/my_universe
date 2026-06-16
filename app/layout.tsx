import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: "Mohammad's Universe (:",
  description: 'Interactive Portfolio',
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
