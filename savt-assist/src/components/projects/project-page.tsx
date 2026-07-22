'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, X, FileText, Image, User, Wrench, CheckCircle2, XCircle, Package, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppModal } from '@/components/ui/app-modal'
import { CabinetCard } from '@/components/cabinets/cabinet-card'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { QrDialog } from '@/components/cabinets/qr-dialog'
import { ProjectQrDialog } from './project-qr-dialog'
import { cabinetsApi } from '@/lib/api/cabinets'
import { projectsApi } from '@/lib/api/projects'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { cn } from '@/lib/utils'
import type { Cabinet, Project } from '@/types'

const PAGE_SIZE = 20
const GRID_CLASSES = 'grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'

const SORT_OPTIONS = [
  { label: 'По типу', value: 'type' },
  { label: 'По назначению', value: 'purpose' },
  { label: 'По гарантии', value: 'warranty_ends_at' },
  { label: 'По дате', value: 'created_at' },
] as const

type WarrantyFilter = 'active' | 'expired' | null
interface CabinetFilters {
  has_documents: boolean
  has_photos: boolean
  has_users: boolean
  has_service_requests: boolean
  warranty_status: WarrantyFilter
}
const DEFAULT_FILTERS: CabinetFilters = {
  has_documents: false,
  has_photos: false,
  has_users: false,
  has_service_requests: false,
  warranty_status: null,
}

interface Props {
  projectId: number
  isAdmin: boolean
  backHref: string
  startEditing?: boolean
}

// Страница конкретного проекта — открывается по клику на карточку проекта
// в "Проекты ШУ" (не модалка, см. обсуждение). Список шкафов запрашивается
// через cabinetsApi.getAll({ project_id }), а не через усечённый cabinets[]
// из GET /admin/projects/{id} — так карточки полноценные (гарантия, теги
// и т.п.) и работают тот же поиск/сортировка/фильтры/пагинация, что и в
// общем списке ШУ.
export function ProjectPage({ projectId, isAdmin, backHref, startEditing }: Props) {
  const router = useRouter()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(!!startEditing)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>()
  const [showQr, setShowQr] = useState(false)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<CabinetFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [openCabinetId, setOpenCabinetId] = useState<number | null>(null)
  const [openCabinetMode, setOpenCabinetMode] = useState<'view' | 'edit'>('view')
  const [qrCabinet, setQrCabinet] = useState<Cabinet | null>(null)
  const [deleteCabinetConfirm, setDeleteCabinetConfirm] = useState<{ id: number; name: string } | null>(null)

  const debouncedSearch = useDebounce(search)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getOne(projectId),
  })

  useEffect(() => {
    if (project) setName(project.name)
  }, [project])

  const renameMutation = useMutation({
    mutationFn: () => projectsApi.update(projectId, name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Проект переименован')
      setEditing(false)
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Проект удалён')
      router.push(backHref)
    },
    onError: () => toast.error('Не удалось удалить проект'),
  })

  const handleSaveName = () => {
    if (!name.trim()) { setNameError('Обязательное поле'); return }
    setNameError(undefined)
    renameMutation.mutate()
  }
  const handleCancelName = () => {
    if (project) setName(project.name)
    setNameError(undefined)
    setEditing(false)
  }

  // Esc — по аналогии с закрытием модалок в остальном приложении. Если
  // поверх страницы уже открыт какой-то диалог/подтверждение — сначала
  // должен закрыться он (это делает сам AppModal/Dialog через base-ui),
  // а не оба действия сразу, поэтому в этих случаях сюда не долетаем.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (deleteProjectConfirm || deleteCabinetConfirm || showQr || openCabinetId !== null || qrCabinet) return
      if (editing) { handleCancelName(); return }
      router.push(backHref)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, deleteProjectConfirm, deleteCabinetConfirm, showQr, openCabinetId, qrCabinet, backHref, router])

  const activeFiltersCount =
    (filters.has_documents ? 1 : 0) +
    (filters.has_photos ? 1 : 0) +
    (filters.has_users ? 1 : 0) +
    (filters.has_service_requests ? 1 : 0) +
    (filters.warranty_status ? 1 : 0)

  const toggleBoolFilter = (key: keyof Omit<CabinetFilters, 'warranty_status'>) =>
    setFilters(f => ({ ...f, [key]: !f[key] }))
  const toggleWarranty = (val: WarrantyFilter) =>
    setFilters(f => ({ ...f, warranty_status: f.warranty_status === val ? null : val }))

  const {
    data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch,
  } = useInfiniteQuery({
    queryKey: ['cabinets', { projectId, search: debouncedSearch, sortBy, sortOrder, filters }],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      cabinetsApi.getAll({
        project_id: projectId,
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: PAGE_SIZE,
        ...(filters.has_documents ? { has_documents: true } : {}),
        ...(filters.has_photos ? { has_photos: true } : {}),
        ...(filters.has_users ? { has_users: true } : {}),
        ...(filters.has_service_requests ? { has_service_requests: true } : {}),
        ...(filters.warranty_status ? { warranty_status: filters.warranty_status } : {}),
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

  const deleteCabinetMutation = useMutation({
    mutationFn: (id: number) => cabinetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('ШУ удалён')
      setDeleteCabinetConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить ШУ'),
  })

  const handleSortClick = (value: string) => {
    if (sortBy === value) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(value); setSortOrder('asc') }
  }

  const allItems = data?.pages.flatMap(p => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  if (projectLoading || !project) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
          <div className="max-w-425 mx-auto flex items-center gap-4">
            <Skeleton className="h-5 w-40" />
          </div>
        </div>
      </div>
    )
  }

  const qrProject: Project = {
    id: project.id,
    name: project.name,
    unique_code: project.unique_code,
    cabinet_count: total,
    created_at: project.created_at,
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <div className="max-w-425 mx-auto">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Все проекты
        </button>

        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-3 mb-4">
          <div className="min-w-0 flex-1">
            {data && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} шкафов</p>}
            {editing ? (
              <div>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(undefined) }}
                  className={cn(
                    'text-lg sm:text-xl font-bold bg-transparent border-b outline-none w-full max-w-md',
                    nameError ? 'border-red-400 text-red-600' : 'border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:border-[#4A8FE7]'
                  )}
                />
                {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
              </div>
            ) : (
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{project.name}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <Button variant="ghost" onClick={handleCancelName} disabled={renameMutation.isPending} className="cursor-pointer">Отмена</Button>
                <Button onClick={handleSaveName} disabled={renameMutation.isPending} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                  {renameMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-[#1B3A72] cursor-pointer" title="Переименовать" onClick={() => setEditing(true)}>
                    <EditIcon />
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowQr(true)} className="gap-2 cursor-pointer">
                  <QrIcon className="w-4 h-4" />
                  QR
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-500 cursor-pointer" title="Удалить проект" onClick={() => setDeleteProjectConfirm(true)}>
                    <TrashIcon />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} title="Список" className={`p-2 transition-colors cursor-pointer ${view === 'list' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <ListIcon />
            </button>
            <button onClick={() => setView('grid')} title="Сетка" className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${view === 'grid' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <GridIcon />
            </button>
            <button onClick={() => setFiltersOpen(v => !v)} title={filtersOpen ? 'Скрыть поиск и фильтры' : 'Показать поиск и фильтры'} className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${filtersOpen ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {filtersOpen && (
        <>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по ШУ этого проекта..."
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
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
                className={`flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${active ? 'bg-[#1B3A72] text-white border-[#1B3A72]' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
              >
                {opt.label}
                {active && <span className="text-xs opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>

        <div className="flex gap-1.5 mt-3 flex-wrap items-center">
          <span className="text-xs text-slate-400 font-medium mr-0.5">Фильтр:</span>
          {([
            { key: 'has_documents', label: 'Документы', icon: FileText },
            { key: 'has_photos', label: 'Фото', icon: Image },
            { key: 'has_users', label: 'Пользователь', icon: User },
            { key: 'has_service_requests', label: 'Заявки', icon: Wrench },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => toggleBoolFilter(key)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${filters[key] ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4A8FE7] hover:text-[#4A8FE7]'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          <button
            onClick={() => toggleWarranty('active')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${filters.warranty_status === 'active' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Гарантия есть
          </button>
          <button
            onClick={() => toggleWarranty('expired')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${filters.warranty_status === 'expired' ? 'bg-rose-500 text-white border-rose-500' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-500'}`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Истекла
          </button>
          {activeFiltersCount > 0 && (
            <button onClick={() => setFilters(DEFAULT_FILTERS)} className="ml-1 px-3 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 transition-colors cursor-pointer">
              Сбросить ({activeFiltersCount})
            </button>
          )}
        </div>
        </>
        )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-425 mx-auto">
        {isLoading && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
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
            <Package className="w-8 h-8 opacity-50" />
            <p className="mt-2">{search ? 'Ничего не найдено' : 'В проекте пока нет шкафов'}</p>
          </div>
        )}

        {allItems.length > 0 && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
            {allItems.map((cabinet) => (
              <CabinetCard
                key={cabinet.id}
                cabinet={cabinet}
                isAdmin={isAdmin}
                view={view}
                loading={false}
                onOpen={() => { setOpenCabinetMode('view'); setOpenCabinetId(cabinet.id) }}
                onEdit={() => { setOpenCabinetMode('edit'); setOpenCabinetId(cabinet.id) }}
                onQr={() => setQrCabinet(cabinet)}
                onDelete={() => setDeleteCabinetConfirm({ id: cabinet.id, name: cabinet.admin_internal_name ?? cabinet.object_number })}
              />
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

        {!hasNextPage && allItems.length > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">Все {total} записей загружены</p>
        )}
        </div>
      </div>

      <CabinetDetailDialog cabinetId={openCabinetId} isAdmin={isAdmin} initialMode={openCabinetMode} onClose={() => setOpenCabinetId(null)} />
      <QrDialog cabinet={qrCabinet} onClose={() => setQrCabinet(null)} />
      <ProjectQrDialog project={showQr ? qrProject : null} onClose={() => setShowQr(false)} />

      {deleteCabinetConfirm && (
        <AppModal open onClose={() => setDeleteCabinetConfirm(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить ШУ?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              <strong>«{deleteCabinetConfirm.name}»</strong> будет удалён безвозвратно.
            </p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Все связанные документы, фото и заявки также будут удалены.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteCabinetConfirm(null)} disabled={deleteCabinetMutation.isPending} className="cursor-pointer">Отмена</Button>
              <Button
                onClick={() => deleteCabinetConfirm && deleteCabinetMutation.mutate(deleteCabinetConfirm.id)}
                disabled={deleteCabinetMutation.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {deleteCabinetMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}

      {deleteProjectConfirm && (
        <AppModal open onClose={() => setDeleteProjectConfirm(false)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить проект?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              <strong>«{project.name}»</strong> будет удалён.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Уникальный код проекта нельзя будет использовать снова, но существующие привязки пользователей и шкафов не изменятся.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteProjectConfirm(false)} disabled={deleteProjectMutation.isPending} className="cursor-pointer">Отмена</Button>
              <Button onClick={() => deleteProjectMutation.mutate()} disabled={deleteProjectMutation.isPending} className="bg-red-500 hover:bg-red-600 cursor-pointer">
                {deleteProjectMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
function ListIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
}
function GridIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
}
function QrIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  )
}
function EditIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
}
function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
