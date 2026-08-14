'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { registersApi } from '@/lib/api/registers'
import { useRealtimeEvents } from '@/lib/hooks/use-realtime-events'
import { cn } from '@/lib/utils'
import type { TelemetryRegister } from '@/types'

const PAGE_SIZE = 20
const NEAR_BOTTOM_PX = 80

function fmtTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Лента телеметрии в виде консоли — переиспользуется и на вкладке ШУ
// (с переключателем "только названные"/"показать все"), и на экране "Карта
// регистров" (форсированный include_unnamed=true, без переключателя — там
// это инструмент подглядеть сырые значения при заполнении карты).
//
// Растёт вниз, как настоящий tail -f: новые события — внизу, автоскролл
// держит низ, пока пользователь сам не проскроллит вверх смотреть историю.
// Бэкенд отдаёт page=1 самым свежим (см. README-backend.md), поэтому для
// показа "старое сверху, новое снизу" мы переворачиваем массив на рендере,
// а подгрузка более старых страниц триггерится сентинелом СВЕРХУ (не снизу).
//
// Пагинация: total/pages бэкенд считает по сырым событиям в БД, до фильтра
// по имени — то есть одна "подгруженная страница" может добавить в ленту
// меньше PAGE_SIZE строк (вплоть до нуля), если почти все сырые события в
// ней были без единого именованного регистра. hasNextPage при этом остаётся
// true, и IntersectionObserver продолжит подтягивать страницы дальше сам —
// это ожидаемое поведение, не баг, но пока идёт этот "поиск" — не молчим и
// не мигаем между "загрузкой" и "пусто", а держим один спокойный статус.
export function TelemetryConsole({ cabinetId, allowToggle = true, initialIncludeUnnamed = false, compact = false }: {
  cabinetId: number
  allowToggle?: boolean
  initialIncludeUnnamed?: boolean
  compact?: boolean
}) {
  const [includeUnnamed, setIncludeUnnamed] = useState(initialIncludeUnnamed)
  const [hasNewBelow, setHasNewBelow] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const loadingOlderRef = useRef(false)
  const firstLoadRef = useRef(true)
  const qc = useQueryClient()
  const queryKey = ['cabinet-telemetry', cabinetId, includeUnnamed]

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      registersApi.getTelemetry(cabinetId, { page: pageParam, size: PAGE_SIZE, include_unnamed: includeUnnamed }),
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  })

  const isNearBottom = () => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }
  const scrollToBottom = () => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  // Подгрузка более старых страниц — сверху, пока видно верхний сентинел.
  useEffect(() => {
    const el = topSentinelRef.current
    const container = containerRef.current
    if (!el || !container) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          prevScrollHeightRef.current = container.scrollHeight
          loadingOlderRef.current = true
          fetchNextPage()
        }
      },
      { root: container, rootMargin: '200px 0px 0px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // После подгрузки старых событий сверху — сохраняем позицию скролла
  // (иначе лента дёргалась бы к началу списка), при самом первом успешном
  // ответе — сразу становимся в самый низ, как и открытая консоль/чат.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || !data) return
    if (loadingOlderRef.current) {
      container.scrollTop += container.scrollHeight - prevScrollHeightRef.current
      loadingOlderRef.current = false
      return
    }
    if (firstLoadRef.current) {
      scrollToBottom()
      firstLoadRef.current = false
    }
  }, [data])

  // Событие несёт только {cabinet_id, event_id}, не сами данные (список
  // персонален из-за include_unnamed) — по сигналу просто перезапрашиваем
  // страницу 1 заново, глубже event не парсим (см. README-backend.md,
  // "Рут admin: telemetry" / SSE-раздел). resetQueries, а не invalidate —
  // иначе переподгрузило бы все уже подгруженные скроллом страницы разом.
  // Доставка at-most-once, как у чатов — на реконнект тоже перезапрашиваем.
  const handleRealtimeUpdate = () => {
    const wasNearBottom = isNearBottom()
    qc.resetQueries({ queryKey }).then(() => {
      if (wasNearBottom) requestAnimationFrame(scrollToBottom)
      else setHasNewBelow(true)
    })
  }

  useRealtimeEvents(
    `/operator/events/cabinets/${cabinetId}/telemetry`,
    ['telemetry.created'],
    handleRealtimeUpdate,
    handleRealtimeUpdate
  )

  const handleScroll = () => { if (isNearBottom()) setHasNewBelow(false) }
  const handleJumpToNew = () => { setHasNewBelow(false); scrollToBottom() }

  const rawItems = data?.pages.flatMap(p => p.items) ?? []
  const items = [...rawItems].reverse()

  // Пока ничего не показано, но поиск среди сырых страниц ещё продолжается
  // (см. комментарий про фильтр выше) — держим один статус, не мигаем.
  const stillSearching = items.length === 0 && !isLoading && (hasNextPage || isFetchingNextPage)
  const trulyEmpty = items.length === 0 && !isLoading && !hasNextPage && !isFetchingNextPage

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

      <div className="relative">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className={cn('overflow-y-auto px-3 py-2 font-mono text-[13px] leading-relaxed', compact ? 'h-64' : 'min-h-[220px] max-h-[60vh]')}
        >
          {isLoading && <p className="text-slate-500">Загрузка…</p>}
          {isError && <p className="text-red-400">Не удалось загрузить телеметрию</p>}
          {trulyEmpty && <p className="text-slate-500">$ ожидание данных с контроллера…</p>}
          {stillSearching && <p className="text-slate-500">Поиск событий среди сырых сообщений…</p>}

          <div ref={topSentinelRef} className="h-1" />
          {isFetchingNextPage && items.length > 0 && (
            <p className="text-slate-600 py-1 text-center">Загрузка более старых событий…</p>
          )}

          {items.map(entry => (
            <div key={entry.id} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 py-0.5 border-b border-slate-900/80 last:border-0">
              <span className="text-slate-600 shrink-0">{fmtTime(entry.received_at)}</span>
              {entry.registers.map((r, i) => <RegisterToken key={i} r={r} />)}
            </div>
          ))}
        </div>

        {hasNewBelow && (
          <button
            onClick={handleJumpToNew}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg cursor-pointer transition-colors"
          >
            ↓ новые события
          </button>
        )}
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
