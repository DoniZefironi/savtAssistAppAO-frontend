import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import { Providers } from '@/components/layout/providers'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SavtAssist',
  description: 'Admin & Operator panel',
}

// Ставит класс(ы) темы на <html> до гидратации — без этого страница на долю
// секунды рисовалась бы светлой (дефолт по разметке), а потом дёргалась в
// тёмную/праздничную, как только отработает эффект в admin-header.tsx. Тема
// хранится в localStorage под ключом 'theme'; если пользователь ни разу не
// выбирал её вручную, дефолт берётся из настройки браузера
// (prefers-color-scheme), а не жёстко зашит в тёмную.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    var mode = (t === 'light' || t === 'dark' || t === 'festive') ? t : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var root = document.documentElement;
    var isDark = mode === 'dark' || mode === 'festive';
    if (isDark) root.classList.add('dark');
    if (mode === 'festive') root.classList.add('theme-festive');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className={`${geist.className} h-full antialiased`}>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
