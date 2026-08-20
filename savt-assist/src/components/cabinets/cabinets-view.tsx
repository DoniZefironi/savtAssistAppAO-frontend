'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, FileText, Image, User, Wrench, FolderKanban, AlertTriangle, SlidersHorizontal, Contact, Truck, RefreshCw } from 'lucide-react'
import { WarrantyChips, type WarrantyFilter } from '@/components/ui/warranty-chips'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AppModal } from '@/components/ui/app-modal'
import { CreateCabinetDialog } from './create-cabinet-dialog'
import { ProjectCard } from '@/components/projects/project-card'
import { ProjectQrDialog } from '@/components/projects/project-qr-dialog'
import { projectsApi, type ProjectCabinetFilters, type ProjectOwnFilters, type ProjectSortField } from '@/lib/api/projects'
import { apiErrorMessage } from '@/lib/api/errors'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel'
import { SearchIcon } from '@/components/ui/icons'
import type { Project } from '@/types'

const PAGE_SIZE = 20

// Сетка карточек: 1 колонка на самых узких, до 4 на широких мониторах
const GRID_CLASSES = 'grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'

// Список возвращает проекты, поэтому все сортировки — проектные, даже когда
// фильтр стоит по шкафам. У гарантии это единственное место, где название
// без уточнения читается двусмысленно (у шкафов проекта своих гарантий много
// и с разными датами), поэтому подписано явно.
const PROJECT_SORT_OPTIONS = [
  { label: 'По названию', value: 'name' },
  { label: 'По дате', value: 'created_at' },
  { label: 'По номеру', value: 'production_number' },
  { label: 'По году', value: 'year' },
  { label: 'По компании', value: 'company_name' },
  { label: 'По отгрузке (план)', value: 'shipment_planned_at' },
  { label: 'По отгрузке (факт)', value: 'shipment_actual_at' },
  { label: 'По гарантии проекта', value: 'warranty_ends_at' },
  { label: 'По числу ШУ', value: 'cabinet_count' },
] as const

type ViewMode = 'list' | 'grid'
// По чему фильтруем список проектов: по самому проекту или по его шкафам.
// Наборы независимы, бэкенд складывает их по И — переключатель определяет
// только то, какой набор сейчас редактируется и показан.
type FilterScope = 'project' | 'cabinets'

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

interface ProjectFilters {
  year: string
  company: string
  shipped: '' | 'yes' | 'no'
  shipment_planned_from: string
  shipment_planned_to: string
  shipment_actual_from: string
  shipment_actual_to: string
  has_project_documents: boolean
  has_project_photos: boolean
  has_project_users: boolean
  has_contacts: boolean
  warranty_status: WarrantyFilter
}

const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  year: '',
  company: '',
  shipped: '',
  shipment_planned_from: '',
  shipment_planned_to: '',
  shipment_actual_from: '',
  shipment_actual_to: '',
  has_project_documents: false,
  has_project_photos: false,
  has_project_users: false,
  has_contacts: false,
  warranty_status: null,
}

interface Props {
  isAdmin: boolean
}

function DateRangeFilter({ label, from, to, onFrom, onTo }: {
  label: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  const active = !!(from || to)
  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs ${
      active ? 'border-[#4A8FE7] text-[#4A8FE7]' : 'border-slate-200 dark:border-slate-700 text-slate-400'
    }`}>
      <span className="shrink-0">{label}</span>
      <input
        type="date"
        value={from}
        onChange={e => onFrom(e.target.value)}
        className="bg-transparent text-slate-600 dark:text-slate-300 focus:outline-none w-27"
      />
      <span className="text-slate-300">—</span>
      <input
        type="date"
        value={to}
        onChange={e => onTo(e.target.value)}
        className="bg-transparent text-slate-600 dark:text-slate-300 focus:outline-none w-27"
      />
      {active && (
        <button
          onClick={() => { onFrom(''); onTo('') }}
          className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
          title="Сбросить период"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// Верхний уровень "Проекты ШУ" — список проектов (переезд из отдельного раздела
// "Проекты" — см. обсуждение). Раньше здесь ещё был режим "Без проекта" —
// отдельный список одиночных шкафов, но ШУ теперь всегда создаётся внутри
// проекта (POST /admin/cabinets требует project_id), так что этот режим убран;
// исторические ШУ без проекта — редкий край случай, для него отдельного UI нет.
export function CabinetsView({ isAdmin }: Props) {
  const router = useRouter()
  const base = isAdmin ? '/admin' : '/operator'
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<string>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<CabinetFilters>(DEFAULT_FILTERS)
  const [projectFilters, setProjectFilters] = useState<ProjectFilters>(DEFAULT_PROJECT_FILTERS)
  const [filterScope, setFilterScope] = useState<FilterScope>('project')
  const [view, setView] = usePersistentState<ViewMode>('view-mode-cabinets', 'list')
  const [filtersOpen, setFiltersOpen] = usePersistentState('filters-open-cabinets', true)
  const [showCreate, setShowCreate] = useState(false)
  const [qrProject, setQrProject] = useState<Project | null>(null)
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState<{ id: number; name: string } | null>(null)

  const debouncedSearch = useDebounce(search)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const cabinetFiltersCount =
    (filters.has_documents ? 1 : 0) +
    (filters.has_photos ? 1 : 0) +
    (filters.has_users ? 1 : 0) +
    (filters.has_service_requests ? 1 : 0) +
    (filters.warranty_status ? 1 : 0)

  const projectFiltersCount =
    (projectFilters.year ? 1 : 0) +
    (projectFilters.company.trim() ? 1 : 0) +
    (projectFilters.shipped ? 1 : 0) +
    (projectFilters.shipment_planned_from || projectFilters.shipment_planned_to ? 1 : 0) +
    (projectFilters.shipment_actual_from || projectFilters.shipment_actual_to ? 1 : 0) +
    (projectFilters.has_project_documents ? 1 : 0) +
    (projectFilters.has_project_photos ? 1 : 0) +
    (projectFilters.has_project_users ? 1 : 0) +
    (projectFilters.has_contacts ? 1 : 0) +
    (projectFilters.warranty_status ? 1 : 0)

  const activeFiltersCount = cabinetFiltersCount + projectFiltersCount

  const toggleBoolFilter = (key: keyof Omit<CabinetFilters, 'warranty_status'>) =>
    setFilters(f => ({ ...f, [key]: !f[key] }))

  // Повторный клик по активному чипу сбрасывает фильтр — это делает сам
  // WarrantyChips, сюда уже приходит итоговое значение
  const setWarranty = (val: WarrantyFilter) =>
    setFilters(f => ({ ...f, warranty_status: val }))

  const toggleProjectBoolFilter = (key: 'has_project_documents' | 'has_project_photos' | 'has_project_users' | 'has_contacts') =>
    setProjectFilters(f => ({ ...f, [key]: !f[key] }))

  const setProjectWarranty = (val: WarrantyFilter) =>
    setProjectFilters(f => ({ ...f, warranty_status: val }))

  const setProjectFilter = <K extends keyof ProjectFilters>(key: K, value: ProjectFilters[K]) =>
    setProjectFilters(f => ({ ...f, [key]: value }))

  const resetAllFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setProjectFilters(DEFAULT_PROJECT_FILTERS)
  }

  // Гарантия шкафов на /admin/projects — это cabinet_warranty_status:
  // одноимённый warranty_status там относится к гарантии самого проекта.
  const projectCabinetFilters: ProjectCabinetFilters = {
    ...(filters.has_documents ? { has_documents: true } : {}),
    ...(filters.has_photos ? { has_photos: true } : {}),
    ...(filters.has_users ? { has_users: true } : {}),
    ...(filters.has_service_requests ? { has_service_requests: true } : {}),
    ...(filters.warranty_status ? { cabinet_warranty_status: filters.warranty_status } : {}),
  }

  const projectOwnFilters: ProjectOwnFilters = {
    ...(projectFilters.year ? { year: Number(projectFilters.year) } : {}),
    ...(projectFilters.company.trim() ? { company: projectFilters.company.trim() } : {}),
    ...(projectFilters.shipped ? { shipped: projectFilters.shipped === 'yes' } : {}),
    ...(projectFilters.shipment_planned_from ? { shipment_planned_from: projectFilters.shipment_planned_from } : {}),
    ...(projectFilters.shipment_planned_to ? { shipment_planned_to: projectFilters.shipment_planned_to } : {}),
    ...(projectFilters.shipment_actual_from ? { shipment_actual_from: projectFilters.shipment_actual_from } : {}),
    ...(projectFilters.shipment_actual_to ? { shipment_actual_to: projectFilters.shipment_actual_to } : {}),
    ...(projectFilters.has_project_documents ? { has_project_documents: true } : {}),
    ...(projectFilters.has_project_photos ? { has_project_photos: true } : {}),
    ...(projectFilters.has_project_users ? { has_project_users: true } : {}),
    ...(projectFilters.has_contacts ? { has_contacts: true } : {}),
    ...(projectFilters.warranty_status ? { warranty_status: projectFilters.warranty_status } : {}),
  }

  const prjQ = useInfiniteQuery({
    queryKey: ['projects', { search: debouncedSearch, sortBy, sortOrder, filters, projectFilters }],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      projectsApi.getAll({
        search: debouncedSearch || undefined,
        sort_by: sortBy as ProjectSortField,
        sort_order: sortOrder,
        page: pageParam,
        size: PAGE_SIZE,
        ...projectCabinetFilters,
        ...projectOwnFilters,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    // Без этого — возврат на экран спустя >30с (глобальный staleTime) после
    // глубокой прокрутки списка переперезапрашивает все закэшированные
    // страницы по очереди подряд. Своя инвалидация после мутаций уже держит
    // список актуальным — авторефетч на маунте не нужен.
    refetchOnMount: false,
  })

  useInfiniteScrollSentinel(sentinelRef, {
    data: prjQ.data,
    hasNextPage: prjQ.hasNextPage,
    isFetchingNextPage: prjQ.isFetchingNextPage,
    isFetchNextPageError: prjQ.isFetchNextPageError,
    fetchNextPage: prjQ.fetchNextPage,
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

  // Кнопка «Синхронизировать все» — то же, что ночной прогон, но по требованию.
  // Ответ несёт готовое сообщение с разбивкой (сколько сверено/перенесено/с
  // ошибкой) — показываем его как есть, а не свою обобщённую фразу.
  const syncAllFoldersMutation = useMutation({
    mutationFn: () => projectsApi.syncAllFolders(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success(res.message)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось синхронизировать проекты')),
  })

  const handleSortClick = (value: string) => {
    if (sortBy === value) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(value)
      setSortOrder('asc')
    }
  }

  const handleSearchChange = (val: string) => setSearch(val)

  const prjItems = prjQ.data?.pages.flatMap((p) => p.items) ?? []
  const total = prjQ.data?.pages[0]?.total ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        <div className="max-w-425 mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-3 mb-4">
          <div className="min-w-0">
            {prjQ.data && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{total} проектов</p>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
              Проекты
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setView('list')}
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
                onClick={() => setView('grid')}
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

            <Button
              onClick={() => syncAllFoldersMutation.mutate()}
              disabled={syncAllFoldersMutation.isPending}
              variant="outline"
              title="Синхронизировать папки всех проектов на NAS"
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${syncAllFoldersMutation.isPending ? 'animate-spin' : ''}`} />
              {syncAllFoldersMutation.isPending ? 'Синхронизация...' : 'Синхронизировать все'}
            </Button>
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

        <div className={`grid transition-[grid-template-rows] duration-150 ease-out ${filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden min-h-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Проект, номер, компания, контактное лицо..."
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
          {PROJECT_SORT_OPTIONS.map((opt) => {
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

          {/* Переключатель области: наборы независимы и складываются по И,
              кнопка лишь выбирает, какой из них сейчас редактируется. Счётчик
              на неактивной вкладке показывает, что там что-то осталось задано. */}
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-full overflow-hidden">
            {([
              { key: 'project', label: 'По проекту', count: projectFiltersCount },
              { key: 'cabinets', label: 'По шкафам', count: cabinetFiltersCount },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilterScope(key)}
                className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  filterScope === key
                    ? 'bg-[#1B3A72] text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#1B3A72]'
                }`}
              >
                {label}
                {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            ))}
          </div>

          {filterScope === 'cabinets' && (
            <>
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
              <WarrantyChips value={filters.warranty_status} onToggle={setWarranty} />
            </>
          )}

          {filterScope === 'project' && (
            <>
              {([
                { key: 'has_project_documents', label: 'Документы проекта', icon: FileText },
                { key: 'has_project_photos', label: 'Фото проекта', icon: Image },
                { key: 'has_project_users', label: 'Участники', icon: User },
                { key: 'has_contacts', label: 'Контакты', icon: Contact },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => toggleProjectBoolFilter(key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    projectFilters[key]
                      ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4A8FE7] hover:text-[#4A8FE7]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
              {([
                { val: 'yes', label: 'Отгружен' },
                { val: 'no', label: 'Не отгружен' },
              ] as const).map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setProjectFilter('shipped', projectFilters.shipped === val ? '' : val)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    projectFilters.shipped === val
                      ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#4A8FE7] hover:text-[#4A8FE7]'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
              <WarrantyChips value={projectFilters.warranty_status} onToggle={setProjectWarranty} />
            </>
          )}

          {activeFiltersCount > 0 && (
            <button
              onClick={resetAllFilters}
              className="ml-1 px-3 py-1 rounded-full text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400 transition-colors cursor-pointer"
            >
              Сбросить ({activeFiltersCount})
            </button>
          )}
        </div>

        {/* Год, компания и диапазоны дат — отдельной строкой: полями ввода,
            а не чипами, поэтому в общий ряд не встают */}
        {filterScope === 'project' && (
          <div className="flex gap-2 mt-2 flex-wrap items-center">
            <input
              type="number"
              inputMode="numeric"
              value={projectFilters.year}
              onChange={e => setProjectFilter('year', e.target.value)}
              placeholder="Год"
              className="w-20 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
            <input
              value={projectFilters.company}
              onChange={e => setProjectFilter('company', e.target.value)}
              placeholder="Компания"
              className="w-44 px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
            <DateRangeFilter
              label="Отгрузка план"
              from={projectFilters.shipment_planned_from}
              to={projectFilters.shipment_planned_to}
              onFrom={v => setProjectFilter('shipment_planned_from', v)}
              onTo={v => setProjectFilter('shipment_planned_to', v)}
            />
            <DateRangeFilter
              label="Отгрузка факт"
              from={projectFilters.shipment_actual_from}
              to={projectFilters.shipment_actual_to}
              onFrom={v => setProjectFilter('shipment_actual_from', v)}
              onTo={v => setProjectFilter('shipment_actual_to', v)}
            />
          </div>
        )}

        {cabinetFiltersCount > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            Показаны проекты, где есть хотя бы один подходящий по фильтру шкаф.
            Сортировка при этом остаётся по полям самого проекта — в списке проекты, а не шкафы.
          </p>
        )}
        </div>
        </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-425 mx-auto">
        {prjQ.isLoading && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
            {Array.from({ length: view === 'grid' ? 6 : 5 }).map((_, i) => (
              <Skeleton key={i} className={view === 'grid' ? 'h-36 w-full rounded-xl' : 'h-20 w-full rounded-xl'} />
            ))}
          </div>
        )}

        {prjQ.isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить список</p>
            <Button variant="outline" onClick={() => prjQ.refetch()} className="cursor-pointer">Повторить</Button>
          </div>
        )}

        {!prjQ.isLoading && !prjQ.isError && prjItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <FolderKanban className="w-8 h-8 opacity-50" />
            <p className="mt-2">
              {search ? 'Ничего не найдено' : 'Нет проектов'}
            </p>
          </div>
        )}

        {prjItems.length > 0 && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-3'}>
            {prjItems.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isAdmin={isAdmin}
                view={view}
                onOpen={() => router.push(`${base}/projects/${project.id}`)}
                onEdit={() => router.push(`${base}/projects/${project.id}?edit=1`)}
                onQr={() => setQrProject(project)}
                onDelete={() => setDeleteProjectConfirm({ id: project.id, name: project.name })}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-1 mt-2" />

        {prjQ.isFetchingNextPage && (
          <div className="flex justify-center py-4">
            <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        )}

        {prjQ.isFetchNextPageError && (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <p className="text-sm text-slate-400">Не удалось подгрузить ещё</p>
            <button onClick={() => prjQ.fetchNextPage()} className="text-sm text-[#1B3A72] hover:underline cursor-pointer">Повторить</button>
          </div>
        )}

        {!prjQ.hasNextPage && prjItems.length > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
            Все {total} записей загружены
          </p>
        )}
        </div>
      </div>

      {isAdmin && <CreateCabinetDialog open={showCreate} onClose={() => setShowCreate(false)} />}

      <ProjectQrDialog project={qrProject} onClose={() => setQrProject(null)} />

      {deleteProjectConfirm && (
        <AppModal open onClose={() => setDeleteProjectConfirm(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить проект?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              <strong>«{deleteProjectConfirm.name}»</strong> будет удалён.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Все ещё живые ШУ проекта тоже будут удалены (как отдельным удалением каждого),
              а чаты проекта и его шкафов — заархивированы. Привязки участников не тронутся:
              если проект позже воскреснет через Bitrix, доступ вернётся, но шкафы и чаты сами не восстановятся.
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
