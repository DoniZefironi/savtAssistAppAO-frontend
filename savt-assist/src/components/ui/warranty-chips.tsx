'use client'

import { CheckCircle2, XCircle, AlertTriangle, MinusCircle } from 'lucide-react'

// Все состояния гарантии, какие знает бэкенд (см. README-backend.md,
// GET /admin/cabinets и GET /admin/projects). null — фильтр снят.
//
// Раньше чипов было два (active/expired), и записи со статусами expiring_soon
// и none не находились ни одним из них: при включённом фильтре гарантии они
// просто пропадали из списка, хотя на карточке статус был виден.
export type WarrantyFilter = 'active' | 'expiring_soon' | 'expired' | 'none' | null

export const WARRANTY_CHIPS = [
  { value: 'active', label: 'Действует', icon: CheckCircle2, on: 'bg-emerald-500 text-white border-emerald-500', off: 'hover:border-emerald-400 hover:text-emerald-600' },
  { value: 'expiring_soon', label: 'Истекает', icon: AlertTriangle, on: 'bg-amber-500 text-white border-amber-500', off: 'hover:border-amber-400 hover:text-amber-600' },
  { value: 'expired', label: 'Истекла', icon: XCircle, on: 'bg-rose-500 text-white border-rose-500', off: 'hover:border-rose-400 hover:text-rose-500' },
  { value: 'none', label: 'Не задана', icon: MinusCircle, on: 'bg-slate-500 text-white border-slate-500', off: 'hover:border-slate-400 hover:text-slate-600' },
] as const

// Одна вёрстка на гарантию проекта и на гарантию шкафов — отличается только то,
// в какой параметр запроса уезжает значение (warranty_status или
// cabinet_warranty_status), а это решает вызывающий код.
export function WarrantyChips({ value, onToggle }: {
  value: WarrantyFilter
  onToggle: (v: WarrantyFilter) => void
}) {
  return (
    <>
      {WARRANTY_CHIPS.map(({ value: v, label, icon: Icon, on, off }) => (
        <button
          key={v}
          onClick={() => onToggle(value === v ? null : v)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            value === v ? on : `bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 ${off}`
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </>
  )
}
