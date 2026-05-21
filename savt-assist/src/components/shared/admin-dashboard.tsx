'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { cabinetsApi } from '@/lib/api/cabinets'
import { useAuthStore } from '@/lib/store/auth'
import { Skeleton } from '@/components/ui/skeleton'

const stats = [
  { key: 'totalCabinets', label: 'Всего ШУ', href: '/admin/cabinets', color: 'bg-blue-500', icon: '📦' },
  { key: 'openServiceRequests', label: 'Открытые заявки', href: null, color: 'bg-amber-500', icon: '🔧' },
  { key: 'pendingCabinetRequests', label: 'Ожидают одобрения', href: null, color: 'bg-red-500', icon: '⏳' },
  { key: 'totalUsers', label: 'Пользователей', href: '/admin/users', color: 'bg-green-500', icon: '👥' },
] as const

export function AdminDashboard() {
  const user = useAuthStore((s) => s.user)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: cabinetsApi.getStats,
  })

  const displayName = user?.full_name ?? user?.login ?? 'Администратор'

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#4A8FE7] to-[#1B3A72] px-8 py-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Добрый день, {displayName}</h1>
            <p className="text-white/70 text-sm mt-1">Панель администратора</p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-white/70 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-8 py-8 space-y-8">
        {/* Stats */}
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Обзор системы</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <StatCard
                key={s.key}
                label={s.label}
                value={data?.[s.key]}
                loading={isLoading}
                href={s.href}
                color={s.color}
                icon={s.icon}
              />
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-4">Быстрый доступ</h2>
          <div className="flex flex-wrap gap-3">
            <QuickLink href="/admin/cabinets" label="Управление ШУ" />
            <QuickLink href="/admin/users" label="Пользователи" />
            <QuickLink href="/admin/settings" label="Настройки" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, loading, href, color, icon,
}: {
  label: string
  value?: number
  loading: boolean
  href: string | null
  color: string
  icon: string
}) {
  const content = (
    <div className="bg-white rounded-xl border border-slate-100 p-5 h-full hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 ${color}/10 rounded-lg flex items-center justify-center text-lg mb-4`}>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <p className="text-3xl font-extrabold text-slate-800">{value ?? '—'}</p>
      )}
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
    </div>
  )

  if (href) return <Link href={href} className="block">{content}</Link>
  return content
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-[#4A8FE7] hover:text-[#4A8FE7] transition-colors"
    >
      {label}
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  )
}
