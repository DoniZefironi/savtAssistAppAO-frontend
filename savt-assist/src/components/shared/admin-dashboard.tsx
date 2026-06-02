'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { cabinetsApi } from '@/lib/api/cabinets'
import { useAuthStore } from '@/lib/store/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const statCards = [
  {
    key: 'totalCabinets' as const,
    label: 'Шкафы управления',
    sublabel: 'всего в системе',
    href: '/admin/cabinets',
    accent: '#1B3A72',
    icon: <BoardIcon />,
  },
  {
    key: 'openServiceRequests' as const,
    label: 'Открытые заявки',
    sublabel: 'требуют внимания',
    href: null,
    accent: '#D97706',
    icon: <WrenchIcon />,
  },
  {
    key: 'pendingCabinetRequests' as const,
    label: 'Ожидают одобрения',
    sublabel: 'новые запросы',
    href: '/admin/requests',
    accent: '#DC2626',
    icon: <ClockIcon />,
  },
  {
    key: 'totalUsers' as const,
    label: 'Пользователей',
    sublabel: 'зарегистрировано',
    href: '/admin/users',
    accent: '#059669',
    icon: <UsersIcon />,
  },
] as const

const navCards = [
  {
    href: '/admin/cabinets',
    title: 'Шкафы управления',
    description: 'Просмотр и управление всеми ШУ, статусы, телеметрия',
    icon: <BoardIcon />,
    accent: '#1B3A72',
  },
  {
    href: '/admin/chats',
    title: 'Чаты',
    description: 'Переписка с пользователями и операторами',
    icon: <ChatIcon />,
    accent: '#7C3AED',
  },
  {
    href: '/admin/users',
    title: 'Пользователи',
    description: 'Управление аккаунтами, роли и права доступа',
    icon: <UsersIcon />,
    accent: '#059669',
  },
  {
    href: '/admin/requests',
    title: 'Заявки',
    description: 'Сервисные заявки, добавление ШУ, запросы на доступ',
    icon: <ClipboardIcon />,
    accent: '#DC2626',
  },
  {
    href: '/admin/kb',
    title: 'База знаний',
    description: 'Статьи, категории и вложения',
    icon: <BookIcon />,
    accent: '#0891B2',
  },
  {
    href: '/admin/settings',
    title: 'Настройки',
    description: 'Конфигурация системы и параметры панели',
    icon: <SettingsIcon />,
    accent: '#64748B',
  },
]

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user)
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: cabinetsApi.getStats,
  })

  const displayName = user?.full_name ?? user?.login ?? 'Администратор'
  const updatedTime = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Добрый день, {displayName}</h1>
            <p className="text-sm text-slate-400 mt-0.5">Панель администратора</p>
          </div>
          <button
            onClick={() => refetch()}
            title="Обновить"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
          >
            <RefreshIcon />
            {updatedTime && <span>обновлено в {updatedTime}</span>}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <StatCard
              key={s.key}
              label={s.label}
              sublabel={s.sublabel}
              value={data?.[s.key]}
              loading={isLoading}
              href={s.href}
              accent={s.accent}
              icon={s.icon}
            />
          ))}
        </div>

        <div>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Разделы</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

function StatCard({
  label, sublabel, value, loading, href, accent, icon,
}: {
  label: string
  sublabel: string
  value?: number
  loading: boolean
  href: string | null
  accent: string
  icon: React.ReactNode
}) {
  const inner = (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 h-full',
      href && 'hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
          <span className="scale-75">{icon}</span>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-14 mb-1.5" />
      ) : (
        <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">{Number.isFinite(value) ? value : '—'}</p>
      )}
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1.5 leading-tight">{label}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>
    </div>
  )

  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

function BoardIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
}
function WrenchIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
}
function ClockIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function UsersIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
}
function ChatIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
}
function SettingsIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.282c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function ClipboardIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
}
function RefreshIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
}
function BookIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
}
