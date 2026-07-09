import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'SMPN 36 — Platform CBT',
  description: 'Platform Ujian & Pembelajaran Digital SMPN 36',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
