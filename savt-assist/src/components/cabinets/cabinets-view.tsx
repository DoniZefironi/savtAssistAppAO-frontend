'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Pagination } from '@/components/ui/pagination'
import type { Cabinet } from '@/types'

const SORT_OPTIONS = [
  { label: 'По типу', value: 'type' },
  { label: 'По гарантии', value: 'warranty_ends_at' },
  { label: 'По дате', value: 'created_at' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

interface Props {
  isAdmin: boolean
}

export function CabinetsView({ isAdmin }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<number | null>(null)
  const [openMode, setOpenMode] = useState<'view' | 'edit'>('view')
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [qrCabinet, setQrCabinet] = useState<Cabinet | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cabinets', { search: debouncedSearch, sortBy, sortOrder, page }],
    queryFn: () =>
      cabinetsApi.getAll({ search: debouncedSearch || undefined, sort_by: sortBy, sort_order: sortOrder, page, size: 10 }),
  })

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
    setPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const openDialog = (id: number, mode: 'view' | 'edit') => {
    setOpenMode(mode)
    setOpenId(id)
  }

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Удалить «${name}»?`)) return
    deleteMutation.mutate(id)
  }

  const items = data?.items ?? []

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <div className="flex items-end justify-between mb-4">
          <div>
            {data && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{data.total} устройств</p>
            )}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Шкафы управления</h1>
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

        <div className="flex gap-2 mt-3">
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

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить список</p>
            <Button variant="outline" onClick={() => refetch()} className="cursor-pointer">Повторить</Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <p className="text-lg">📦</p>
            <p className="mt-2">{search ? 'Ничего не найдено' : 'Нет шкафов управления'}</p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((cabinet) => (
              <CabinetCard
                key={cabinet.id}
                cabinet={cabinet}
                isAdmin={isAdmin}
                loading={loadingId === cabinet.id}
                onOpen={() => openDialog(cabinet.id, 'view')}
                onEdit={() => openDialog(cabinet.id, 'edit')}
                onQr={() => setQrCabinet(cabinet)}
                onDelete={() => handleDelete(cabinet.id, cabinet.admin_internal_name ?? cabinet.object_number)}
              />
            ))}
          </div>
        )}
      </div>

      {data && data.pages > 1 && (
        <Pagination page={page} pages={data.pages} onPage={setPage} />
      )}

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
