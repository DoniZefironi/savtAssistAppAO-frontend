'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { cabinetsApi } from '@/lib/api/cabinets'
import type { ActivityItem } from '@/lib/api/cabinets'
import { useAuthStore } from '@/lib/store/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CabinetsMap } from '@/components/map/cabinets-map'

function makeStatCards(base: string) {
  return [
    { key: 'unreadChats' as const,             label: 'Новых сообщений',      href: `${base}/chats`,    accent: '#1B3A72', urgentAbove: 0, icon: <ChatIcon /> },
    { key: 'openServiceRequests' as const,      label: 'Открытых заявок',      href: `${base}/requests`, accent: '#D97706', urgentAbove: 0, icon: <WrenchIcon /> },
    { key: 'pendingDocumentRequests' as const,  label: 'Запросов на документы',href: `${base}/requests`, accent: '#7C3AED', urgentAbove: 0, icon: <DocIcon /> },
    { key: 'pendingShareRequests' as const,     label: 'Доступов к ШУ',        href: `${base}/requests`, accent: '#0891B2', urgentAbove: 0, icon: <KeyIcon /> },
    { key: 'pendingAdditionRequests' as const,  label: 'Добавлений ШУ',        href: `${base}/requests`, accent: '#059669', urgentAbove: 0, icon: <PlusBoxIcon /> },
  ] as const
}


export function AdminDashboard() {
  const user = useAuthStore((s) => s.user)
  const isOperator = user?.role === 'operator'
  const base = isOperator ? '/operator' : '/admin'
  const displayName = user?.full_name ?? user?.login ?? (isOperator ? 'Оператор' : 'Администратор')
  const statCards = makeStatCards(base)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: cabinetsApi.getDashboard,
    refetchInterval: 15_000,
    staleTime: 10_000,
  })

  const stats = data?.stats
  const activity = data?.activity
  const statsLoading = isLoading
  const activityLoading = isLoading

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Добрый день, {displayName}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {statCards.map((s) => {
            const value = stats?.[s.key]
            const urgent = typeof value === 'number' && value > s.urgentAbove
            return (
              <Link key={s.key} href={s.href} className="block group">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-white" style={{ backgroundColor: s.accent }}>
                      <span className="scale-75">{s.icon}</span>
                    </div>
                    {urgent && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-6 w-10 mb-1" />
                  ) : (
                    <p className={cn('text-xl font-extrabold leading-none', urgent ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500')}>
                      {Number.isFinite(value) ? value : '—'}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{s.label}</p>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Карта расположения ШУ</span>
          </div>
          <div className="h-[500px] p-3">
            <CabinetsMap isAdmin={!isOperator} />
          </div>
        </div>

        {!isOperator && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/60">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Последняя активность</span>
              <span className="text-xs text-slate-400">последние 20 событий</span>
            </div>
            {activityLoading ? (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/40">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            ) : !activity || activity.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                <InboxIcon className="w-8 h-8" />
                <p className="text-sm">Нет активности</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50 dark:divide-slate-700/40">
                {activity.map((item) => (
                  <ActivityRow key={`${item.type}-${item.id}`} item={item} />
                ))}
              </ul>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

const TYPE_META: Record<ActivityItem['type'], { label: string; color: string; icon: React.ReactNode }> = {
  service:   { label: 'Сервисная заявка',   color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',  icon: <WrenchIcon /> },
  document:  { label: 'Запрос на документ', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400', icon: <DocIcon /> },
  share:     { label: 'Доступ к ШУ',        color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',      icon: <KeyIcon /> },
  addition:  { label: 'Добавление ШУ',      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400', icon: <PlusBoxIcon /> },
}

const STATUS_STYLE: Record<string, string> = {
  open:       'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  in_progress:'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  closed:     'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
  pending:    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  approved:   'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
  rejected:   'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'открыта', in_progress: 'в работе', closed: 'закрыта',
  pending: 'ожидает', approved: 'одобрено', rejected: 'отклонено',
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const meta = TYPE_META[item.type]
  return (
    <li className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0', meta.color)}>
        <span className="scale-75">{meta.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
          <span className="font-medium">{meta.label}</span>
          {item.user && <span className="text-slate-400 dark:text-slate-500"> · {item.user}</span>}
          {item.detail && <span className="text-slate-400 dark:text-slate-500"> · {item.detail}</span>}
        </p>
      </div>
      <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_STYLE[item.status] ?? STATUS_STYLE.pending)}>
        {STATUS_LABEL[item.status] ?? item.status}
      </span>
      <span className="shrink-0 text-[11px] text-slate-300 dark:text-slate-600 w-20 text-right">
        {relativeTime(item.created_at)}
      </span>
    </li>
  )
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'только что'
  if (mins < 60) return `${mins} мин.`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} ч.`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'вчера'
  if (days < 7)  return `${days} дн.`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function ChatIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
}
function WrenchIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
}
function DocIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
}
function KeyIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
}
function PlusBoxIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function InboxIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.235 2.235 0 00-.1.661z" /></svg>
}
