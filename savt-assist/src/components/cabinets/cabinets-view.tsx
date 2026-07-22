'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, FileText, Image, User, Wrench, CheckCircle2, XCircle, Package, FolderKanban, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppModal } from '@/components/ui/app-modal'
import { CabinetCard } from './cabinet-card'
import { CabinetDetailDialog } from './cabinet-detail-dialog'
import { CreateCabinetDialog } from './create-cabinet-dialog'
import { QrDialog } from './qr-dialog'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectDetailDialog } from '@/components/projects/project-detail-dialog'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ProjectQrDialog } from '@/components/projects/project-qr-dialog'
import { cabinetsApi } from '@/lib/api/cabinets'
import { projectsApi, type ProjectCabinetFilters } from '@/lib/api/projects'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import type { Cabinet, Project } from '@/types'

const PAGE_SIZE = 20

// Сетка карточек: 1 колонка на самых узких, до 4 на широких мониторах
const GRID_CLASSES = 'grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'

const CABINET_SORT_OPTIONS = [
  { label: 'По типу', value: 'type' },
  { label: 'По назначению', value: 'purpose' },
  { label: 'По гарантии', value: 'warranty_ends_at' },
  { label: 'По дате', value: 'created_at' },
] as const
const PROJECT_SORT_OPTIONS = [
  { label: 'По названию', value: 'name' },
  { label: 'По дате', value: 'created_at' },
] as const

type ViewMode = 'list' | 'grid'
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
  isAdmin: boolean
}

// Верхний уровень "Проекты ШУ": по умолчанию список проектов (переезд из
// отдельного раздела "Проекты" — см. обсуждение), тоггл "Без проекта"
// переключает список на одиночные шкафы, не привязанные ни к одному проекту.
// Общие фильтры (документы/фото/...) продолжают работать в обоих режимах:
// в режиме проектов они фильтруют по наличию хотя бы одного подходящего
// шкафа внутри проекта (см. ProjectCabinetFilters), в режиме "без проекта" —
// как раньше, напрямую по самим шкафам.
export function CabinetsView({ isAdmin }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<CabinetFilters>(DEFAULT_FILTERS)
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [view, setView] = useState<ViewMode>('list')
  useEffect(() => {
    const saved = localStorage.getItem('view-mode-cabinets')
    if (saved === 'list' || saved === 'grid') setView(saved)
  }, [])
  const [filtersOpen, setFiltersOpen] = usePersistentState('filters-open-cabinets', true)
  const [openId, setOpenId] = useState<number | null>(null)
  const [openMode, setOpenMode] = useState<'view' | 'edit'>('view')
  const [qrCabinet, setQrCabinet] = useState<Cabinet | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null)
  const [openProjectId, setOpenProjectId] = useState<number | null>(null)
  const [qrProject, setQrProject] = useState<Project | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: number; name: string } | null>(null)

  const debouncedSearch = useDebounce(search)
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  const projectCabinetFilters: ProjectCabinetFilters = {
    ...(filters.has_documents ? { has_documents: true } : {}),
    ...(filters.has_photos ? { has_photos: true } : {}),
    ...(filters.has_users ? { has_users: true } : {}),
    ...(filters.has_service_requests ? { has_service_requests: true } : {}),
    ...(filters.warranty_status ? { warranty_status: filters.warranty_status } : {}),
  }

  const toggleScope = () => {
    setUnassignedOnly(v => !v)
    setSortBy('created_at')
    setSortOrder('desc')
  }

  const cabQ = useInfiniteQuery({
    queryKey: ['cabinets', { search: debouncedSearch, sortBy, sortOrder, filters, unassignedOnly }],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      cabinetsApi.getAll({
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: PAGE_SIZE,
        ...(unassignedOnly ? { has_project: false } : {}),
        ...(filters.has_documents ? { has_documents: true } : {}),
        ...(filters.has_photos ? { has_photos: true } : {}),
        ...(filters.has_users ? { has_users: true } : {}),
        ...(filters.has_service_requests ? { has_service_requests: true } : {}),
        ...(filters.warranty_status ? { warranty_status: filters.warranty_status } : {}),
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: unassignedOnly,
  })

  const prjQ = useInfiniteQuery({
    queryKey: ['projects', { search: debouncedSearch, sortBy, sortOrder, filters }],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      projectsApi.getAll({
        search: debouncedSearch || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: PAGE_SIZE,
        ...projectCabinetFilters,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: !unassignedOnly,
  })

  const curQ = unassignedOnly ? cabQ : prjQ

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && curQ.hasNextPage && !curQ.isFetchingNextPage) {
          curQ.fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [curQ.hasNextPage, curQ.isFetchingNextPage, curQ.fetchNextPage])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cabinetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('ШУ удалён')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить ШУ'),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Проект удалён')
      setDeleteProjectConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить проект'),
  })

  const sortOptions = unassignedOnly ? CABINET_SORT_OPTIONS : PROJECT_SORT_OPTIONS
  const handleSortClick = (value: string) => {
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

  const handleDelete = (id: number, name: string) => setDeleteConfirm({ id, name })

  const handleConfirmDelete = () => {
    if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id)
  }

  const cabItems = cabQ.data?.pages.flatMap((p) => p.items) ?? []
  const prjItems = prjQ.data?.pages.flatMap((p) => p.items) ?? []
  const allItems: (Cabinet | Project)[] = unassignedOnly ? cabItems : prjItems
  const total = curQ.data?.pages[0]?.total ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <div className="max-w-425 mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-3 mb-4">
          <div className="min-w-0">
            {curQ.data && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{total} {unassignedOnly ? 'шкафов' : 'проектов'}</p>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
              {unassignedOnly ? 'Шкафы без проекта' : 'Проекты'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
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
              <button
                onClick={() => setFiltersOpen(v => !v)}
                title={filtersOpen ? 'Скрыть поиск и фильтры' : 'Показать поиск и фильтры'}
                className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${
                  filtersOpen
                    ? 'bg-[#1B3A72] text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {isAdmin && !unassignedOnly && (
              <Button
                onClick={() => setShowCreateProject(true)}
                variant="outline"
                className="gap-2 cursor-pointer"
              >
                <PlusIcon />
                Добавить проект
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 dark:text-white gap-2 cursor-pointer"
              >
                <PlusIcon />
                Добавить ШУ
              </Button>
            )}
          </div>
        </div>

        {filtersOpen && (
        <>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={unassignedOnly ? 'Поиск по ШУ...' : 'Поиск по проектам...'}
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {sortOptions.map((opt) => {
            const active = sortBy === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleSortClick(opt.value)}
                className={`flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {opt.label}
                {active && <span className="text-xs opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>

        <div className="flex gap-1.5 mt-3 flex-wrap items-center">
          <span className="text-xs text-slate-400 font-medium mr-0.5">Фильтр:</span>
          <button
            onClick={toggleScope}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              unassignedOnly
                ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#1B3A72] hover:text-[#1B3A72]'
            }`}
          >
            <NoProjectIcon className="w-3.5 h-3.5" />
            Без проекта
          </button>
          {([
            { key: 'has_documents', label: 'Документы', icon: FileText },
            { key: 'has_photos', label: 'Фото', icon: Image },
            { key: 'has_users', label: 'Пользователь', icon: User },
            { key: 'has_service_requests', label: 'Заявки', icon: Wrench },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => toggleBoolFilter(key)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                filters[key]
                  ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4A8FE7] hover:text-[#4A8FE7]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
          <button
            onClick={() => toggleWarranty('active')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              filters.warranty_status === 'active'
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Гарантия есть
          </button>
          <button
            onClick={() => toggleWarranty('expired')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              filters.warranty_status === 'expired'
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-500'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Истекла
          </button>
          {activeFiltersCount > 0 && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="ml-1 px-3 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 transition-colors cursor-pointer"
            >
              Сбросить ({activeFiltersCount})
            </button>
          )}
        </div>
        {!unassignedOnly && activeFiltersCount > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Показаны проекты, где есть хотя бы один подходящий по фильтру шкаф
          </p>
        )}
        </>
        )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-425 mx-auto">
        {curQ.isLoading && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
            {Array.from({ length: view === 'grid' ? 6 : 5 }).map((_, i) => (
              <Skeleton key={i} className={view === 'grid' ? 'h-36 w-full rounded-xl' : 'h-20 w-full rounded-xl'} />
            ))}
          </div>
        )}

        {curQ.isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить список</p>
            <Button variant="outline" onClick={() => curQ.refetch()} className="cursor-pointer">Повторить</Button>
          </div>
        )}

        {!curQ.isLoading && !curQ.isError && allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            {unassignedOnly ? <Package className="w-8 h-8 opacity-50" /> : <FolderKanban className="w-8 h-8 opacity-50" />}
            <p className="mt-2">
              {search ? 'Ничего не найдено' : unassignedOnly ? 'Нет шкафов без проекта' : 'Нет проектов'}
            </p>
          </div>
        )}

        {unassignedOnly && cabItems.length > 0 && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
            {cabItems.map((cabinet) => (
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

        {!unassignedOnly && prjItems.length > 0 && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
            {prjItems.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isAdmin={isAdmin}
                view={view}
                onOpen={() => setOpenProjectId(project.id)}
                onQr={() => setQrProject(project)}
                onDelete={() => setDeleteProjectConfirm({ id: project.id, name: project.name })}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-1 mt-2" />

        {curQ.isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {!curQ.hasNextPage && allItems.length > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
            Все {total} записей загружены
          </p>
        )}
        </div>
      </div>

      <CabinetDetailDialog cabinetId={openId} isAdmin={isAdmin} initialMode={openMode} onClose={() => setOpenId(null)} />
      {isAdmin && <CreateCabinetDialog open={showCreate} onClose={() => setShowCreate(false)} />}
      <QrDialog cabinet={qrCabinet} onClose={() => setQrCabinet(null)} />

      <ProjectDetailDialog projectId={openProjectId} isAdmin={isAdmin} filters={projectCabinetFilters} onClose={() => setOpenProjectId(null)} />
      {isAdmin && <CreateProjectDialog open={showCreateProject} onClose={() => setShowCreateProject(false)} />}
      <ProjectQrDialog project={qrProject} onClose={() => setQrProject(null)} />

      {deleteConfirm && (
        <AppModal open onClose={() => setDeleteConfirm(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить ШУ?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              <strong>«{deleteConfirm.name}»</strong> будет удалён безвозвратно.
            </p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Все связанные документы, фото и заявки также будут удалены.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)} disabled={deleteMutation.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}

      {deleteProjectConfirm && (
        <AppModal open onClose={() => setDeleteProjectConfirm(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить проект?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              <strong>«{deleteProjectConfirm.name}»</strong> будет удалён.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Уникальный код проекта нельзя будет использовать снова, но существующие привязки пользователей и шкафов не изменятся.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteProjectConfirm(null)} disabled={deleteProjectMutation.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={() => deleteProjectConfirm && deleteProjectMutation.mutate(deleteProjectConfirm.id)}
                disabled={deleteProjectMutation.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
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
function NoProjectIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 4.5h.129a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18.75A2.25 2.25 0 0121 9.75v7.5a2.25 2.25 0 01-.673 1.606M19.5 19.5H5.25A2.25 2.25 0 013 17.25V6.75c0-.844.494-1.573 1.208-1.913" />
    </svg>
  )
}
