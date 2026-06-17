'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CabinetCard } from './cabinet-card'
import { CabinetDetailDialog } from './cabinet-detail-dialog'
import { CreateCabinetDialog } from './create-cabinet-dialog'
import { QrDialog } from './qr-dialog'
import { cabinetsApi } from '@/lib/api/cabinets'
import { useDebounce } from '@/lib/hooks/use-debounce'
import type { Cabinet } from '@/types'

const PAGE_SIZE = 20

const SORT_OPTIONS = [
  { label: 'По типу', value: 'type' },
  { label: 'По гарантии', value: 'warranty_ends_at' },
  { label: 'По дате', value: 'created_at' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']
type ViewMode = 'list' | 'grid'

interface Props {
  isAdmin: boolean
}

export function CabinetsView({ isAdmin }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [view, setView] = useState<ViewMode>('list')
  useEffect(() => {
    const saved = localStorage.getItem('view-mode-cabinets')
    if (saved === 'list' || saved === 'grid') setView(saved)
  }, [])
  const [openId, setOpenId] = useState<number | null>(null)
  const [openMode, setOpenMode] = useState<'view' | 'edit'>('view')
  const [qrCabinet, setQrCabinet] = useState<Cabinet | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const debouncedSearch = useDebounce(search)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['cabinets', { search: debouncedSearch, sortBy, sortOrder }],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      cabinetsApi.getAll({
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  })

  // Infinite scroll — trigger next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cabinetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('ШУ удалён')
    },
    onError: () => toast.error('Не удалось удалить ШУ'),
  })

  const handleSortClick = (value: SortValue) => {
    if (sortBy === value) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(value)
      setSortOrder('asc')
    }
  }

  const handleSearchChange = (val: string) => setSearch(val)

  const openDialog = (id: number, mode: 'view' | 'edit') => {
    setOpenMode(mode)
    setOpenId(id)
  }

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Удалить «${name}»?`)) return
    deleteMutation.mutate(id)
  }

  const allItems = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <div className="flex items-end justify-between mb-4">
          <div>
            {data && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{total} устройств</p>
            )}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Шкафы управления</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => { setView('list'); localStorage.setItem('view-mode-cabinets', 'list') }}
                title="Список"
                className={`p-2 transition-colors cursor-pointer ${
                  view === 'list'
                    ? 'bg-[#1B3A72] text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <ListIcon />
              </button>
              <button
                onClick={() => { setView('grid'); localStorage.setItem('view-mode-cabinets', 'grid') }}
                title="Сетка"
                className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${
                  view === 'grid'
                    ? 'bg-[#1B3A72] text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <GridIcon />
              </button>
            </div>

            {isAdmin && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 gap-2 cursor-pointer"
              >
                <PlusIcon />
                Добавить ШУ
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Поиск по ШУ..."
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleSortClick(opt.value)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {active && <span>✓</span>}
                {opt.label}
                {active && <span className="text-xs opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
            {Array.from({ length: view === 'grid' ? 6 : 5 }).map((_, i) => (
              <Skeleton key={i} className={view === 'grid' ? 'h-36 w-full rounded-xl' : 'h-20 w-full rounded-xl'} />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить список</p>
            <Button variant="outline" onClick={() => refetch()} className="cursor-pointer">Повторить</Button>
          </div>
        )}

        {!isLoading && !isError && allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <p className="text-lg">📦</p>
            <p className="mt-2">{search ? 'Ничего не найдено' : 'Нет шкафов управления'}</p>
          </div>
        )}

        {allItems.length > 0 && (
          <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
            {allItems.map((cabinet) => (
              <CabinetCard
                key={cabinet.id}
                cabinet={cabinet}
                isAdmin={isAdmin}
                view={view}
                loading={false}
                onOpen={() => openDialog(cabinet.id, 'view')}
                onEdit={() => openDialog(cabinet.id, 'edit')}
                onQr={() => setQrCabinet(cabinet)}
                onDelete={() => handleDelete(cabinet.id, cabinet.admin_internal_name ?? cabinet.object_number)}
              />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1 mt-2" />

        {isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {!hasNextPage && allItems.length > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
            Все {total} записей загружены
          </p>
        )}
      </div>

      <CabinetDetailDialog cabinetId={openId} isAdmin={isAdmin} initialMode={openMode} onClose={() => setOpenId(null)} />
      {isAdmin && <CreateCabinetDialog open={showCreate} onClose={() => setShowCreate(false)} />}
      <QrDialog cabinet={qrCabinet} onClose={() => setQrCabinet(null)} />
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}
