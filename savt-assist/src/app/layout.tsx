import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { Providers } from '@/components/layout/providers'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SavtAssist',
  description: 'Admin & Operator panel',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className={`${geist.className} h-full antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
