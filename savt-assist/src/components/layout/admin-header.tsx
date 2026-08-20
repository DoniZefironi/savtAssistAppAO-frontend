'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/auth'
import { NotificationBell } from './notification-bell'

// 'festive' — отдельный, самостоятельный вариант оформления (радужный,
// поверх тёмной базы) — см. .theme-festive в globals.css. Нет отдельного
// пункта «Системная»: пока пользователь ни разу не выбрал тему вручную,
// светлая/тёмная определяется автоматически по настройке браузера
// (prefers-color-scheme) — см. prefersDark() и THEME_INIT_SCRIPT в
// app/layout.tsx. Как только выбор сделан явно, он просто сохраняется и
// больше не следит за ОС.
type ThemeMode = 'light' | 'dark' | 'festive'

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'light', label: 'Светлая', icon: SunIcon },
  { value: 'dark', label: 'Тёмная', icon: MoonIcon },
  { value: 'festive', label: 'Праздничная', icon: SparkleIcon },
]

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyThemeClasses(mode: ThemeMode) {
  const isDark = mode === 'dark' || mode === 'festive'
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('theme-festive', mode === 'festive')
}

export function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  // 'dark' по умолчанию — совпадает с THEME_INIT_SCRIPT в app/layout.tsx,
  // чтобы первый рендер этого компонента не расходился с уже применённым
  // классом на <html> (иначе иконка на кнопке дёрнулась бы после гидратации).
  // Реальный дефолт (light/dark по браузеру) выставляет THEME_INIT_SCRIPT,
  // этот стейт лишь синхронизируется с ним ниже в эффекте.
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [profileOpen, setProfileOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuthStore()
  const isOperator = user?.role === 'operator'
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('theme') as ThemeMode | null
    const mode: ThemeMode = saved === 'light' || saved === 'dark' || saved === 'festive' ? saved : (prefersDark() ? 'dark' : 'light')
    setTheme(mode)
    applyThemeClasses(mode)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectTheme = (mode: ThemeMode) => {
    setTheme(mode)
    localStorage.setItem('theme', mode)
    applyThemeClasses(mode)
    setThemeMenuOpen(false)
  }

  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
    router.push('/login')
    toast.success('Вы вышли из системы')
  }

  const initials = user
    ? (user.full_name ?? user.login ?? '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="flex-shrink-0 h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 flex items-center px-4 gap-2 z-10">
      <button
        onClick={onMenuClick}
        className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="Меню"
      >
        <HamburgerIcon />
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <NotificationBell />

        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setThemeMenuOpen(v => !v)}
            title="Тема оформления"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {(() => {
              const ActiveIcon = THEME_OPTIONS.find((opt) => opt.value === theme)?.icon ?? MoonIcon
              return <ActiveIcon />
            })()}
          </button>

          {themeMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 py-1.5 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => selectTheme(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors cursor-pointer text-left',
                    theme === opt.value
                      ? 'text-[#1B3A72] dark:text-blue-400 font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  )}
                >
                  <opt.icon className="w-4 h-4 shrink-0" />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative ml-1" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="theme-accent-static w-7 h-7 rounded-full bg-[#1B3A72] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block max-w-32 truncate">
              {user?.full_name ?? user?.login ?? ''}
            </span>
            <ChevronDownIcon className={cn('w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200', profileOpen && 'rotate-180')} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 py-1.5 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
              {user && (
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{user.full_name ?? user.login}</p>
                  <p className="text-xs text-slate-400 mt-0.5 capitalize">{user.role}</p>
                </div>
              )}
              {!isOperator && (
                <div className="py-1">
                  <Link
                    href="/admin/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 shrink-0" />
                    Настройки
                  </Link>
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogoutIcon className="w-4 h-4 flex-shrink-0" />
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function HamburgerIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
}
function MoonIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
}
function SunIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
}
function SparkleIcon({ className }: { className?: string }) {
  return <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.282c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function LogoutIcon({ className }: { className?: string }) {
  return <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
}
function ChevronDownIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
}
