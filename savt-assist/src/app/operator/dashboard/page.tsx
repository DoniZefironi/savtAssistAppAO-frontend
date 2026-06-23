'use client'

import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth'
import { CabinetsMap } from '@/components/map/cabinets-map'

const navCards = [
  {
    href: '/operator/cabinets',
    title: 'Шкафы управления',
    description: 'Просмотр всех ШУ и их деталей',
    icon: <BoardIcon />,
    accent: '#1B3A72',
  },
  {
    href: '/operator/chats',
    title: 'Чаты',
    description: 'Переписка с пользователями',
    icon: <ChatIcon />,
    accent: '#7C3AED',
  },
]

export default function OperatorDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const displayName = user?.full_name ?? user?.login ?? 'Оператор'

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Добрый день, {displayName}</h1>
            <p className="text-sm text-slate-400 mt-0.5">Панель оператора</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Карта расположения ШУ</span>
          </div>
          <div className="h-[500px] p-3">
            <CabinetsMap isAdmin={false} />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Разделы</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            {navCards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3 text-white"
                  style={{ backgroundColor: c.accent }}
                >
                  {c.icon}
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white leading-snug">{c.title}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-snug">{c.description}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function BoardIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
}
function ChatIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
}
