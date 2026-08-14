'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { registersApi } from '@/lib/api/registers'
import { useRealtimeEvents } from '@/lib/hooks/use-realtime-events'
import { cn } from '@/lib/utils'
import type { TelemetryRegister } from '@/types'

const PAGE_SIZE = 20

function fmtTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Лента телеметрии в виде консоли — переиспользуется и на вкладке ШУ
// (с переключателем "только названные"/"показать все"), и на экране "Карта
// регистров" (форсированный include_unnamed=true, без переключателя — там
// это инструмент подглядеть сырые значения при заполнении карты).
//
// Пагинация подгружается скроллом (как везде в проекте), но important: total/
// pages бэкенд считает по сырым событиям в БД, до фильтра по имени — то есть
// одна "подгруженная страница" может добавить в ленту меньше PAGE_SIZE строк
// (вплоть до нуля), если почти все сырые события в ней были без единого
// именованного регистра. hasNextPage при этом остаётся true, и
// IntersectionObserver автоматически подтянет следующую страницу — это
// ожидаемое поведение, не баг.
export function TelemetryConsole({ cabinetId, allowToggle = true, initialIncludeUnnamed = false, compact = false }: {
  cabinetId: number
  allowToggle?: boolean
  initialIncludeUnnamed?: boolean
  compact?: boolean
}) {
  const [includeUnnamed, setIncludeUnnamed] = useState(initialIncludeUnnamed)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const queryKey = ['cabinet-telemetry', cabinetId, includeUnnamed]

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      registersApi.getTelemetry(cabinetId, { page: pageParam, size: PAGE_SIZE, include_unnamed: includeUnnamed }),
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Событие несёт только {cabinet_id, event_id}, не сами данные (список
  // персонален из-за include_unnamed) — по сигналу просто перезапрашиваем
  // страницу 1 заново, глубже event не парсим (см. README-backend.md,
  // "Рут admin: telemetry" / SSE-раздел). resetQueries, а не invalidate —
  // иначе переподгрузило бы все уже подгруженные скроллом страницы разом.
  const resetToFirstPage = () => qc.resetQueries({ queryKey })

  // Доставка at-most-once, как у чатов — на реконнект тоже стоит перезапросить
  // вручную, не полагаться только на поток.
  useRealtimeEvents(
    `/operator/events/cabinets/${cabinetId}/telemetry`,
    ['telemetry.created'],
    resetToFirstPage,
    resetToFirstPage
  )

  const items = data?.pages.flatMap(p => p.items) ?? []

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="text-xs text-slate-500 font-mono ml-2">телеметрия</span>
          <span className="flex items-center gap-1 ml-1" title="Обновляется в реальном времени">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-500/80 font-mono">live</span>
          </span>
        </div>
        {allowToggle && (
          <button
            onClick={() => setIncludeUnnamed(v => !v)}
            className={cn(
              'text-[11px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer',
              includeUnnamed
                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            )}
          >
            {includeUnnamed ? 'показаны все' : 'только названные'}
          </button>
        )}
      </div>

      <div className={cn('flex-1 overflow-y-auto px-3 py-2 font-mono text-[13px] leading-relaxed', compact ? 'h-64' : 'min-h-[220px] max-h-[60vh]')}>
        {isLoading && <p className="text-slate-500">Загрузка…</p>}
        {isError && <p className="text-red-400">Не удалось загрузить телеметрию</p>}
        {!isLoading && !isError && items.length === 0 && (
          <p className="text-slate-500">$ ожидание данных с контроллера…</p>
        )}
        {items.map(entry => (
          <div key={entry.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 py-0.5 border-b border-slate-900/80 last:border-0">
            <span className="text-slate-600 shrink-0">{fmtTime(entry.received_at)}</span>
            {entry.registers.map((r, i) => <RegisterToken key={i} r={r} />)}
          </div>
        ))}
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && <p className="text-slate-600 py-1">Загрузка…</p>}
      </div>
    </div>
  )
}

function RegisterToken({ r }: { r: TelemetryRegister }) {
  const unknown = r.name === null
  if (unknown) {
    return (
      <span className="text-amber-400" title="Регистр не описан в карте — заведите под него запись">
        Регистр&nbsp;{r.address}=<span className="text-amber-300">{r.value}</span>
      </span>
    )
  }
  return (
    <span className="text-emerald-400">
      {r.name}=<span className="text-emerald-300">{r.value}</span>
    </span>
  )
}
