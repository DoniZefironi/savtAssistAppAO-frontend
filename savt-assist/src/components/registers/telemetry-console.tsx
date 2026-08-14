'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { registersApi } from '@/lib/api/registers'
import { useRealtimeEvents } from '@/lib/hooks/use-realtime-events'
import { cn } from '@/lib/utils'
import type { TelemetryRegister } from '@/types'

const PAGE_SIZE = 20
const NEAR_BOTTOM_PX = 80
const REFRESH_DEBOUNCE_MS = 400

function fmtTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// Пагинированная история сырых событий (GET /admin/cabinets/{id}/telemetry/history)
// в виде консоли — для разбора аварии постфактум. Текущее состояние карты
// регистров прямо сейчас — отдельный компонент, TelemetryLiveBoard (тот, что
// раньше был GET .../telemetry, теперь плоский снимок без пагинации).
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
export function TelemetryHistoryConsole({ cabinetId, allowToggle = true, initialIncludeUnnamed = false, compact = false, realtimeSignal }: {
  cabinetId: number
  allowToggle?: boolean
  initialIncludeUnnamed?: boolean
  compact?: boolean
  // Если задан — своё SSE-соединение не открывается, обновление ждём по
  // этому сигналу извне (см. cabinet-telemetry-tab.tsx: рядом рендерится и
  // TelemetryLiveBoard на тот же канал — если бы оба компонента сами
  // подписывались, на каждое реальное событие открывалось бы два SSE-
  // соединения на один путь и удваивался бы поток инвалидаций).
  realtimeSignal?: number
}) {
  const [includeUnnamed, setIncludeUnnamed] = useState(initialIncludeUnnamed)
  const [hasNewBelow, setHasNewBelow] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef(0)
  const loadingOlderRef = useRef(false)
  const firstLoadRef = useRef(true)
  const qc = useQueryClient()
  const queryKey = ['cabinet-telemetry-history', cabinetId, includeUnnamed]
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError } = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      registersApi.getTelemetryHistory(cabinetId, { page: pageParam, size: PAGE_SIZE, include_unnamed: includeUnnamed }),
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  })
  const hasNextPageRef = useRef(hasNextPage)
  const isFetchingNextPageRef = useRef(isFetchingNextPage)
  const isFetchNextPageErrorRef = useRef(isFetchNextPageError)
  const isIntersectingRef = useRef(false)
  useEffect(() => {
    hasNextPageRef.current = hasNextPage
    isFetchingNextPageRef.current = isFetchingNextPage
    isFetchNextPageErrorRef.current = isFetchNextPageError
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

  const maybeFetchOlder = () => {
    const container = containerRef.current
    if (!container) return
    if (!hasNextPageRef.current || isFetchingNextPageRef.current || isFetchNextPageErrorRef.current) return
    prevScrollHeightRef.current = container.scrollHeight
    loadingOlderRef.current = true
    fetchNextPage()
  }

  // Подгрузка более старых страниц — сверху, пока видно верхний сентинел.
  // Наблюдатель создаётся ОДИН раз (пустой список зависимостей), актуальные
  // hasNextPage/isFetchingNextPage/isFetchNextPageError колбэк читает через
  // рефы. Пересоздавать IntersectionObserver в эффекте с зависимостями
  // [hasNextPage, isFetchingNextPage, fetchNextPage] — соблазнительно, но
  // баг: по спецификации каждый (пере)вызов .observe() обязан один раз
  // асинхронно отдать колбэку ТЕКУЩЕЕ состояние пересечения. Если сентинел
  // не двигается (например, страница упала с 429 и список не вырос),
  // isFetchingNextPage гоняется false→true→false на каждую попытку — и
  // каждый такой переход пересоздаёт observer и тем самым эквивалентен ещё
  // одному "срабатыванию" без единого реального скролла: та же страница
  // долбится заново без всякой паузы, и цикл не может остановить сам себя
  // (реальный инцидент — см. лог с 429 на этой ручке).
  useEffect(() => {
    const el = topSentinelRef.current
    const container = containerRef.current
    if (!el || !container) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersectingRef.current = entry.isIntersecting
        if (entry.isIntersecting) maybeFetchOlder()
      },
      { root: container, rootMargin: '200px 0px 0px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // После УСПЕШНОЙ подгрузки — если сентинел всё ещё виден (пустая
  // отфильтрованная страница не заполнила экран) — продолжаем сами, не
  // дожидаясь скролла. На ошибке data не меняется (react-query оставляет
  // предыдущее значение) — этот эффект не перезапустится, и цикл повторов
  // не сможет самоподдерживаться.
  useEffect(() => {
    if (!data) return
    if (isIntersectingRef.current) maybeFetchOlder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

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
  // иначе переподгрузило бы все уже подгруженные скроллом страницы разом
  // (именно поэтому дебаунс тут особенно важен — resetQueries на инфинит-
  // запросе переспрашивает ВСЕ уже подгруженные страницы целиком, а не одну,
  // и без дебаунса частые события умножали бы нагрузку на их число).
  // Доставка at-most-once, как у чатов — на реконнект тоже перезапрашиваем.
  const handleRealtimeUpdate = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const wasNearBottom = isNearBottom()
      qc.resetQueries({ queryKey }).then(() => {
        if (wasNearBottom) requestAnimationFrame(scrollToBottom)
        else setHasNewBelow(true)
      })
    }, REFRESH_DEBOUNCE_MS)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const isControlled = realtimeSignal !== undefined
  useRealtimeEvents(
    isControlled ? null : `/operator/events/cabinets/${cabinetId}/telemetry`,
    ['telemetry.created'],
    handleRealtimeUpdate,
    handleRealtimeUpdate
  )

  const isFirstSignal = useRef(true)
  useEffect(() => {
    if (!isControlled) return
    if (isFirstSignal.current) { isFirstSignal.current = false; return }
    handleRealtimeUpdate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeSignal])

  const handleScroll = () => { if (isNearBottom()) setHasNewBelow(false) }
  const handleJumpToNew = () => { setHasNewBelow(false); scrollToBottom() }

  const rawItems = data?.pages.flatMap(p => p.items) ?? []
  const items = [...rawItems].reverse()

  // Пока ничего не показано, но поиск среди сырых страниц ещё продолжается
  // (см. комментарий про фильтр выше) — держим один статус, не мигаем.
  const stillSearching = items.length === 0 && !isLoading && !isFetchNextPageError && (hasNextPage || isFetchingNextPage)
  const trulyEmpty = items.length === 0 && !isLoading && !isFetchNextPageError && !hasNextPage && !isFetchingNextPage

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="text-xs text-slate-500 font-mono ml-2">история</span>
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
          {isFetchNextPageError && (
            <div className="flex items-center justify-center gap-2 py-1.5 text-center">
              <span className="text-red-400">Не удалось подгрузить историю</span>
              <button
                onClick={() => fetchNextPage()}
                className="text-[11px] font-mono px-2 py-0.5 rounded border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white transition-colors cursor-pointer"
              >
                Повторить
              </button>
            </div>
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

// value — состояние бита (0/1), а не сырое число регистра: показываем как
// вкл/выкл, единица — ярче (это реально сработавшее состояние).
function RegisterToken({ r }: { r: TelemetryRegister }) {
  const unknown = r.name === null
  const active = r.value === 1
  const label = unknown ? `Регистр ${r.address}.${r.bit}` : r.name

  if (unknown) {
    return (
      <span className="text-amber-400" title="Регистр не описан в карте — заведите под него запись">
        {label}={active ? <span className="text-amber-300 font-semibold">1</span> : <span className="text-amber-600">0</span>}
      </span>
    )
  }
  return (
    <span className={active ? 'text-emerald-300 font-semibold' : 'text-slate-500'}>
      {label}={active ? '1' : '0'}
    </span>
  )
}
