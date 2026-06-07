import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'StrixMind — AI Business Operating System',
  description: 'AI-native WhatsApp CRM, inbox, and workflow automation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="ambient-1" />
        <div className="ambient-2" />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
