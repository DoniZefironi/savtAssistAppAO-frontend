'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { X, SlidersHorizontal, ScrollText, ChevronDown, Bot, User, Shield, Settings2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { auditApi, type AuditLog } from '@/lib/api/audit'

const PAGE_SIZE = 50

const ACTOR_ROLE_FILTERS = [
  { value: undefined, label: 'Все' },
  { value: 'admin', label: 'Админ' },
  { value: 'operator', label: 'Оператор' },
  { value: 'user', label: 'Пользователь' },
  { value: 'system', label: 'Система' },
] as const

const SORT_OPTIONS = [
  { value: 'created_at', label: 'По дате' },
  { value: 'action', label: 'По действию' },
  { value: 'entity_type', label: 'По типу сущности' },
  { value: 'actor_role', label: 'По роли' },
  { value: 'actor_id', label: 'По исполнителю' },
] as const

const SEARCH_IN_OPTIONS = [
  { value: 'all', label: 'Везде' },
  { value: 'action', label: 'Действие' },
  { value: 'entity_type', label: 'Тип сущности' },
  { value: 'actor_name', label: 'Исполнитель' },
  { value: 'payload', label: 'Payload' },
] as const

function actorRoleLabel(role: string): string {
  if (role === 'admin') return 'Админ'
  if (role === 'operator') return 'Оператор'
  if (role === 'user') return 'Пользователь'
  if (role === 'system') return 'Система'
  return role
}

function ActorIcon({ role, className }: { role: string; className?: string }) {
  if (role === 'system') return <Settings2 className={className} />
  if (role === 'admin') return <Shield className={className} />
  if (role === 'operator') return <Bot className={className} />
  return <User className={className} />
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Журнал административных действий, только для просмотра. Суперадмин видит всё
// (CUD по шкафам/проектам/документам/пользователям + заявки), обычный админ/оператор —
// только заявочные entity_type (сервер сам сужает выдачу, см. README-backend.md,
// "Рут admin: audit" — отдельного client-side ограничения делать не нужно).
export function AuditLogView() {
  const [search, setSearch] = useState('')
  const [searchIn, setSearchIn] = useState<typeof SEARCH_IN_OPTIONS[number]['value']>('all')
  const [actorRole, setActorRole] = useState<typeof ACTOR_ROLE_FILTERS[number]['value']>(undefined)
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<typeof SORT_OPTIONS[number]['value']>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filtersOpen, setFiltersOpen] = usePersistentState('filters-open-audit', true)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const debouncedSearch = useDebounce(search)
  const debouncedEntityType = useDebounce(entityType)
  const debouncedAction = useDebounce(action)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const activeFiltersCount =
    (actorRole ? 1 : 0) +
    (entityType.trim() ? 1 : 0) +
    (action.trim() ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  const resetFilters = () => {
    setActorRole(undefined)
    setEntityType('')
    setAction('')
    setDateFrom('')
    setDateTo('')
  }

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['audit-logs', {
      search: debouncedSearch, searchIn, actorRole, entityType: debouncedEntityType,
      action: debouncedAction, dateFrom, dateTo, sortBy, sortOrder,
    }],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      auditApi.getLogs({
        search: debouncedSearch || undefined,
        search_in: debouncedSearch ? searchIn : undefined,
        actor_role: actorRole,
        entity_type: debouncedEntityType || undefined,
        action: debouncedAction || undefined,
        date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
        date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: PAGE_SIZE,
      }),
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

  const handleSortClick = (value: typeof SORT_OPTIONS[number]['value']) => {
    if (sortBy === value) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(value); setSortOrder('desc') }
  }

  const items = data?.pages.flatMap(p => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <div className="max-w-425 mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-3 mb-4">
          <div className="min-w-0">
            {data && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} записей</p>}
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Журнал действий</h1>
          </div>
          <button
            onClick={() => setFiltersOpen(v => !v)}
            title={filtersOpen ? 'Скрыть поиск и фильтры' : 'Показать поиск и фильтры'}
            className={cn(
              'p-2 rounded-lg border transition-colors cursor-pointer',
              filtersOpen
                ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {filtersOpen && (
        <>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по журналу..."
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {search && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs text-slate-400 font-medium mr-0.5">Искать в:</span>
            {SEARCH_IN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSearchIn(opt.value)}
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  searchIn === opt.value
                    ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4A8FE7]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3 flex-wrap">
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleSortClick(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  active
                    ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                {opt.label}
                {active && <span className="text-xs opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-xs text-slate-400 font-medium mr-0.5">Роль:</span>
          {ACTOR_ROLE_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => setActorRole(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                actorRole === f.value
                  ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
          <Input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="Тип сущности (cabinet, project...)"
            className="text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500" />
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Действие (create, delete...)"
            className="text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500" />
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200" />
        </div>

        {activeFiltersCount > 0 && (
          <button onClick={resetFilters} className="mt-2 px-3 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 transition-colors cursor-pointer">
            Сбросить фильтры ({activeFiltersCount})
          </button>
        )}
        </>
        )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-425 mx-auto">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить журнал</p>
            <Button variant="outline" onClick={() => refetch()} className="cursor-pointer">Повторить</Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <ScrollText className="w-8 h-8 opacity-50" />
            <p className="mt-2">Записей не найдено</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            {items.map((log) => (
              <AuditLogRow key={log.id} log={log} expanded={expandedId === log.id} onToggle={() => setExpandedId(id => id === log.id ? null : log.id)} />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-1 mt-2" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {!hasNextPage && items.length > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">Все {total} записей загружены</p>
        )}
        </div>
      </div>
    </div>
  )
}

function AuditLogRow({ log, expanded, onToggle }: { log: AuditLog; expanded: boolean; onToggle: () => void }) {
  const hasPayload = log.payload != null && Object.keys(log.payload).length > 0
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
          <ActorIcon role={log.actor_role} className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{log.action}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
              {log.entity_type}{log.entity_id != null ? ` #${log.entity_id}` : ''}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {log.actor_name ?? (log.actor_id != null ? `#${log.actor_id}` : '—')} · {actorRoleLabel(log.actor_role)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">{fmtDateTime(log.created_at)}</span>
          {hasPayload && (
            <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', expanded && 'rotate-180')} />
          )}
        </div>
      </button>
      {expanded && hasPayload && (
        <div className="px-4 pb-3">
          <pre className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg p-3 overflow-x-auto text-slate-600 dark:text-slate-300">
            {JSON.stringify(log.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
