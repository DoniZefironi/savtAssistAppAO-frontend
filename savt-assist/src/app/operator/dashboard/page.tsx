'use client'

import Link from 'next/link'
import { useAuthStore } from '@/lib/store/auth'

export default function OperatorDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const displayName = user?.full_name ?? user?.login ?? 'Оператор'

  return (
    <div>
      <div className="bg-gradient-to-r from-[#4A8FE7] to-[#1B3A72] px-8 py-8">
        <h1 className="text-2xl font-bold text-white">Добрый день, {displayName}</h1>
        <p className="text-white/70 text-sm mt-1">Панель оператора</p>
      </div>
      <div className="px-8 py-8">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Быстрый доступ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <Link
            href="/operator/cabinets"
            className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-[#4A8FE7] transition-all group"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl mb-3">📦</div>
            <p className="font-semibold text-slate-800 group-hover:text-[#1B3A72]">Шкафы управления</p>
            <p className="text-sm text-slate-400 mt-0.5">Просмотр всех ШУ и их деталей</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
