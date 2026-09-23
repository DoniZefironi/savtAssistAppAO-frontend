'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reclamationsApi } from '@/lib/api/reclamations'
import type { ReclamationBitrixOutboxItem } from '@/types'

const OPERATION_LABEL: Record<ReclamationBitrixOutboxItem['operation'], string> = {
  create: 'создание карточки',
  status: 'смена стадии',
  assignee: 'назначение ответственного',
}

// Один общий queryKey на все места (список рекламаций и карточка) — react-query
// сам дедуплицирует запрос, второго обращения к бэкенду не будет.
const OUTBOX_QUERY = {
  queryKey: ['reclamation-bitrix-outbox'],
  queryFn: reclamationsApi.getBitrixOutbox,
} as const

export function useBitrixOutbox(enabled: boolean) {
  return useQuery({ ...OUTBOX_QUERY, enabled })
}

function fmtWhen(iso: string | null): string {
  if (!iso) return 'ещё не пробовали'
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Плашка над списком рекламаций: в норме очередь пуста и не видно ничего
// вообще. Отдельного экрана нет намеренно — застрявшая операция важна ровно
// в тот момент, когда сломалась, а экран, который открывают раз в месяц,
// этого не показывает. Список read-only: повторы делает фоновая задача
// каждые 15 минут, кнопки «повторить сейчас» в API нет.
export function BitrixOutboxNotice({ items }: { items: ReclamationBitrixOutboxItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="flex-1 min-w-0 text-sm text-amber-700 dark:text-amber-300">
          {items.length === 1
            ? 'Одна операция не ушла в Bitrix'
            : `${items.length} операций не ушли в Bitrix`} — эти рекламации разъехались с порталом
        </span>
        <ChevronDown className={cn('w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden min-h-0">
          <div className="px-3 sm:px-4 pb-3 space-y-2">
            {items.map(i => (
              <div key={i.id} className="rounded-lg bg-white/70 dark:bg-slate-800/60 border border-amber-100 dark:border-amber-900/40 px-3 py-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  Рекламация #{i.reclamation_id} · {OPERATION_LABEL[i.operation]} · попыток: {i.attempts}
                </p>
                {i.last_error && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 wrap-break-word">{i.last_error}</p>
                )}
                <p className="text-[11px] text-slate-400 mt-0.5">Последняя попытка: {fmtWhen(i.last_attempted_at)}</p>
              </div>
            ))}
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
              Повтор идёт сам каждые 15 минут. Если попыток много, а последняя давно — разбираться нужно руками.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// То же самое, но про одну конкретную рекламацию — внутри её карточки.
// Объясняет ровно ту ситуацию, из-за которой обычно и приходят с вопросами:
// в админке поменяли, а в Bitrix «ничего не происходит».
export function BitrixOutboxCardWarning({ items }: { items: ReclamationBitrixOutboxItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="px-4 sm:px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-y border-amber-100 dark:border-amber-900/40">
      {items.map(i => (
        <div key={i.id} className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Не ушло в Bitrix: {OPERATION_LABEL[i.operation]} (попыток: {i.attempts}). Повтор идёт автоматически.
            </p>
            {i.last_error && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 wrap-break-word">{i.last_error}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
