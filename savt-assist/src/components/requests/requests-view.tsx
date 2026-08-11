'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { X, ClipboardList, SlidersHorizontal, AlertTriangle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toFullUrl } from '@/lib/api/base-url'
import { requestsApi } from '@/lib/api/requests'
import type { ServiceRequest, AdditionRequest, DocumentRequest, ProjectRequest, PhoneChangeRequest } from '@/lib/api/requests'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/lib/store/auth'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CabinetCombobox } from '@/components/ui/cabinet-combobox'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { RequestCard, ServiceCardIcon, AdditionCardIcon, StatusPill, TypePill } from './request-card'
import { UserDialog } from '@/components/users/user-dialog'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { ProjectDetailDialog } from '@/components/projects/project-detail-dialog'
import { ServiceDialog } from './service-dialog'
import {
  DRow, DRowLink, ModalTextarea, DialogHeader, VerifiedBadge,
  svcStatusCls, svcStatusLabel, reqStatusCls, reqStatusLabel, reqTypeCls, reqTypeLabel,
  userTypeLabel, fmtDate,
} from './request-shared'

type Tab = 'service' | 'additions' | 'projects' | 'docs' | 'phone'

// Сетка карточек заявок: 1 колонка на самых узких, до 4 на широких мониторах
const GRID_CLASSES = 'grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'

const TABS: { id: Tab; label: string }[] = [
  { id: 'service', label: 'Сервисные' },
  { id: 'additions', label: 'Добавление ШУ' },
  { id: 'projects', label: 'Проекты' },
  { id: 'docs', label: 'Документы' },
  { id: 'phone', label: 'Смена номера' },
]

const SVC_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Открытые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'postponed', label: 'Отложенные' },
  { value: 'closed', label: 'Закрытые' },
]
const REQ_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'approved', label: 'Одобренные' },
  { value: 'rejected', label: 'Отклонённые' },
]
// У заявок на смену номера есть ещё cancelled — пользователь отозвал сам
const PHONE_FILTERS = [...REQ_FILTERS, { value: 'cancelled', label: 'Отозванные' }]

const SVC_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'closed_at', label: 'По закрытию' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'cabinet_object_number', label: 'По ШУ' },
  { value: 'request_type', label: 'По типу' },
]
const ADDITIONS_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'resolved_at', label: 'По рассмотрению' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
]
const PROJECTS_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'resolved_at', label: 'По рассмотрению' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'project_name', label: 'По проекту' },
]
const DOC_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'resolved_at', label: 'По рассмотрению' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'doc_type', label: 'По типу' },
]
const PHONE_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'resolved_at', label: 'По рассмотрению' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
]

const REQUEST_TYPE_FILTERS = [
  { value: 'all', label: 'Все типы' },
  { value: 'repair', label: 'Ремонт' },
  { value: 'diagnostics', label: 'Диагностика' },
  { value: 'remote_adjustment', label: 'Наладка удалённо' },
  { value: 'onsite_adjustment', label: 'Наладка с выездом' },
  { value: 'other', label: 'Другое' },
]

type ViewMode = 'list' | 'grid'

export function RequestsView() {
  const currentUser = useAuthStore(s => s.user)
  const [tab, setTab] = useState<Tab>('service')
  const [statusFilter, setStatusFilter] = useState('all')
  const [requestTypeFilter, setRequestTypeFilter] = useState('all')
  const [resolvedByAdminId, setResolvedByAdminId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Список админов для дропдауна "Обработал" — доступен только суперадмину
  // (GET /admin/admins), поэтому для остальных ролей используется числовой ID.
  const [view, setView] = useState<ViewMode>('list')
  useEffect(() => {
    const saved = localStorage.getItem('view-mode-requests')
    if (saved === 'list' || saved === 'grid') setView(saved)
  }, [])
  const [filtersOpen, setFiltersOpen] = usePersistentState('filters-open-requests', true)
  const [selectedService, setSelectedService] = useState<ServiceRequest | null>(null)
  const [selectedAddition, setSelectedAddition] = useState<AdditionRequest | null>(null)
  const [selectedProjectRequest, setSelectedProjectRequest] = useState<ProjectRequest | null>(null)
  const [selectedPhoneRequest, setSelectedPhoneRequest] = useState<PhoneChangeRequest | null>(null)
  const [selectedDocRequest, setSelectedDocRequest] = useState<DocumentRequest | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setStatusFilter('all')
    setRequestTypeFilter('all')
    setResolvedByAdminId(null)
    setSearchInput('')
    setSearch('')
    setSortBy('created_at')
    setSortOrder('desc')
  }
  const handleFilterChange = (f: string) => setStatusFilter(f)
  const handleSortClick = (value: string) => {
    if (sortBy === value) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(value); setSortOrder('asc') }
  }

  const sp = statusFilter === 'all' ? undefined : statusFilter
  const sq = search || undefined
  const rtp = requestTypeFilter === 'all' ? undefined : requestTypeFilter

  const svcQ = useInfiniteQuery({
    queryKey: ['service-requests', sp, sq, sortBy, sortOrder, rtp],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getServiceRequests({ status: sp, search: sq, request_type: rtp, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'service',
  })
  const addQ = useInfiniteQuery({
    queryKey: ['addition-requests', sp, sq, sortBy, sortOrder, resolvedByAdminId],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getAdditions({ status: sp, search: sq, resolved_by_admin_id: resolvedByAdminId ?? undefined, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'additions',
  })
  const prjQ = useInfiniteQuery({
    queryKey: ['project-requests', sp, sq, sortBy, sortOrder, resolvedByAdminId],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getProjectRequests({ status: sp, search: sq, resolved_by_admin_id: resolvedByAdminId ?? undefined, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'projects',
  })
  const docQ = useInfiniteQuery({
    queryKey: ['document-requests', sp, sq, sortBy, sortOrder, resolvedByAdminId],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getDocumentRequests({ status: sp, search: sq, resolved_by_admin_id: resolvedByAdminId ?? undefined, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'docs',
  })
  const phoneQ = useInfiniteQuery({
    queryKey: ['phone-change-requests', sp, sq, sortBy, sortOrder, resolvedByAdminId],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getPhoneChangeRequests({ status: sp, search: sq, resolved_by_admin_id: resolvedByAdminId ?? undefined, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'phone',
  })

  const curQ = tab === 'service' ? svcQ : tab === 'additions' ? addQ : tab === 'projects' ? prjQ : tab === 'phone' ? phoneQ : docQ
  const total = curQ.data?.pages[0]?.total

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
  }, [curQ.hasNextPage, curQ.isFetchingNextPage, curQ.fetchNextPage, tab])

  const svcItems = svcQ.data?.pages.flatMap(p => p.items) ?? []
  const addItems = addQ.data?.pages.flatMap(p => p.items) ?? []
  const prjItems = prjQ.data?.pages.flatMap(p => p.items) ?? []
  const docItems = docQ.data?.pages.flatMap(p => p.items) ?? []
  const phoneItems = phoneQ.data?.pages.flatMap(p => p.items) ?? []

  const filters = tab === 'service' ? SVC_FILTERS : tab === 'phone' ? PHONE_FILTERS : REQ_FILTERS
  const sortOptions =
    tab === 'service' ? SVC_SORT :
    tab === 'additions' ? ADDITIONS_SORT :
    tab === 'projects' ? PROJECTS_SORT :
    tab === 'phone' ? PHONE_SORT :
    DOC_SORT

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60">
        <div className="max-w-425 mx-auto w-full">
        <div className="flex items-end justify-between gap-2 mb-4">
          <div className="min-w-0">
            {total != null && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} заявок</p>}
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Заявки</h1>
          </div>
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shrink-0">
            <button onClick={() => { setView('list'); localStorage.setItem('view-mode-requests', 'list') }} title="Список" className={`p-2 transition-colors cursor-pointer ${view === 'list' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ListIcon /></button>
            <button onClick={() => { setView('grid'); localStorage.setItem('view-mode-requests', 'grid') }} title="Сетка" className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${view === 'grid' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><GridIcon /></button>
            <button onClick={() => setFiltersOpen(v => !v)} title={filtersOpen ? 'Скрыть поиск и фильтры' : 'Показать поиск и фильтры'} className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${filtersOpen ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><SlidersHorizontal className="w-4 h-4" /></button>
          </div>
        </div>
        {/* Табы не переносятся (сломали бы вид подчёркнутой навигации) — на узких экранах скроллятся горизонтально */}
        <div className="flex gap-0 mb-3 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap',
                tab === t.id
                  ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {filtersOpen && (
        <>
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по заявкам..."
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {sortOptions.length > 0 && (
            <>
              {sortOptions.map(opt => {
                const active = sortBy === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSortClick(opt.value)}
                    className={cn(
                      'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                      active
                        ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    {opt.label}
                    {active && <span className="opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                )
              })}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-slate-400 font-medium mr-0.5">Фильтр:</span>
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => handleFilterChange(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                statusFilter === f.value
                  ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {tab === 'service' && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs text-slate-400 font-medium mr-0.5">Тип:</span>
            {REQUEST_TYPE_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setRequestTypeFilter(f.value)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  requestTypeFilter === f.value
                    ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        </>
        )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-425 mx-auto">
        {curQ.isLoading && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-2'}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`bg-white dark:bg-slate-800 rounded-xl animate-pulse ${view === 'grid' ? 'h-36' : 'h-16'}`} />
            ))}
          </div>
        )}
        {curQ.isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить заявки</p>
            <button onClick={() => curQ.refetch()} className="text-sm text-[#1B3A72] hover:underline cursor-pointer">Повторить</button>
          </div>
        )}

        {tab === 'service' && !svcQ.isLoading && !svcQ.isError && (
          <ServiceList items={svcItems} onSelect={setSelectedService} view={view} />
        )}
        {tab === 'additions' && !addQ.isLoading && !addQ.isError && (
          <AdditionsList items={addItems} onSelect={setSelectedAddition} view={view} />
        )}
        {tab === 'projects' && !prjQ.isLoading && !prjQ.isError && (
          <ProjectRequestsList items={prjItems} onSelect={setSelectedProjectRequest} view={view} />
        )}
        {tab === 'docs' && !docQ.isLoading && !docQ.isError && (
          <DocumentRequestList items={docItems} onSelect={setSelectedDocRequest} view={view} />
        )}
        {tab === 'phone' && !phoneQ.isLoading && !phoneQ.isError && (
          <PhoneChangeList items={phoneItems} onSelect={setSelectedPhoneRequest} view={view} />
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
        {!curQ.hasNextPage && (total ?? 0) > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
            Все {total} записей загружены
          </p>
        )}
        </div>
      </div>

      {selectedService && <ServiceDialog request={selectedService} onClose={() => setSelectedService(null)} />}
      {selectedAddition && <AdditionDialog request={selectedAddition} onClose={() => setSelectedAddition(null)} />}
      {selectedProjectRequest && <ProjectRequestDialog request={selectedProjectRequest} onClose={() => setSelectedProjectRequest(null)} />}
      {selectedDocRequest && <DocumentRequestDialog request={selectedDocRequest} onClose={() => setSelectedDocRequest(null)} />}
      {selectedPhoneRequest && <PhoneChangeDialog request={selectedPhoneRequest} onClose={() => setSelectedPhoneRequest(null)} />}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
      <ClipboardList className="w-8 h-8 mb-2 opacity-50" />
      <p>{text}</p>
    </div>
  )
}

function gridCls(view: ViewMode) {
  return view === 'grid' ? GRID_CLASSES : 'space-y-2'
}

function ServiceList({ items, onSelect, view }: { items: ServiceRequest[]; onSelect: (r: ServiceRequest) => void; view: ViewMode }) {
  if (!items.length) return <Empty text="Нет сервисных заявок" />
  return (
    <div className={gridCls(view)}>
      {items.map(item => (
        <RequestCard
          key={item.id}
          view={view}
          icon={<ServiceCardIcon />}
          title={item.cabinet_object_number ? `ШУ ${item.cabinet_object_number}` : `Проект: ${item.project_name}`}
          subtitle={item.user_full_name ?? '—'}
          meta={<TypePill label={reqTypeLabel(item.request_type)} cls={reqTypeCls(item.request_type)} />}
          statusBadge={<StatusPill label={svcStatusLabel(item.status)} cls={svcStatusCls(item.status)} />}
          date={fmtDate(item.created_at)}
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  )
}

function AdditionsList({ items, onSelect, view }: { items: AdditionRequest[]; onSelect: (r: AdditionRequest) => void; view: ViewMode }) {
  if (!items.length) return <Empty text="Нет заявок на добавление" />
  return (
    <div className={gridCls(view)}>
      {items.map(item => (
        <RequestCard
          key={item.id}
          view={view}
          icon={<AdditionCardIcon />}
          title={item.user_full_name ?? '—'}
          subtitle={item.project_name ? `Проект: ${item.project_name}` : (item.user_phone ?? '—')}
          meta={item.organization_name
            ? <TypePill label={item.organization_name} cls="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" />
            : undefined}
          statusBadge={<StatusPill label={reqStatusLabel(item.status)} cls={reqStatusCls(item.status)} />}
          date={fmtDate(item.created_at)}
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  )
}

function PhoneChangeList({ items, onSelect, view }: { items: PhoneChangeRequest[]; onSelect: (r: PhoneChangeRequest) => void; view: ViewMode }) {
  if (!items.length) return <Empty text="Нет заявок на смену номера" />
  return (
    <div className={gridCls(view)}>
      {items.map(item => (
        <RequestCard
          key={item.id}
          view={view}
          icon={<PhoneChangeCardIcon />}
          title={item.user_full_name ?? '—'}
          subtitle={`${item.old_phone ?? '—'} → ${item.new_phone}`}
          meta={
            // pending_rivals > 1 — на этот номер претендует несколько аккаунтов.
            // Одобрять не разобравшись нельзя, поэтому подсвечиваем прямо в списке.
            item.status === 'pending' && item.pending_rivals > 1
              ? <TypePill label={`Конкурирующих заявок: ${item.pending_rivals}`} cls="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
              : item.organization_name
              ? <TypePill label={item.organization_name} cls="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" />
              : undefined
          }
          statusBadge={<StatusPill label={reqStatusLabel(item.status)} cls={reqStatusCls(item.status)} />}
          date={fmtDate(item.created_at)}
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  )
}

function ProjectRequestsList({ items, onSelect, view }: { items: ProjectRequest[]; onSelect: (r: ProjectRequest) => void; view: ViewMode }) {
  if (!items.length) return <Empty text="Нет заявок на проекты" />
  return (
    <div className={gridCls(view)}>
      {items.map(item => (
        <RequestCard
          key={item.id}
          view={view}
          icon={<ProjectRequestCardIcon />}
          title={item.user_full_name ?? '—'}
          subtitle={item.project_name}
          meta={item.organization_name
            ? <TypePill label={item.organization_name} cls="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" />
            : undefined}
          statusBadge={<StatusPill label={reqStatusLabel(item.status)} cls={reqStatusCls(item.status)} />}
          date={fmtDate(item.created_at)}
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  )
}

function DocumentRequestList({ items, onSelect, view }: { items: DocumentRequest[]; onSelect: (r: DocumentRequest) => void; view: ViewMode }) {
  if (!items.length) return <Empty text="Нет заявок на документы" />
  return (
    <div className={gridCls(view)}>
      {items.map(item => (
        <RequestCard
          key={item.id}
          view={view}
          icon={<DocRequestCardIcon />}
          title={item.user_full_name ?? '—'}
          subtitle={item.cabinet_id ? `ШУ #${item.cabinet_id}` : item.project_id ? `Проект #${item.project_id}` : '—'}
          meta={
            <TypePill
              label={item.doc_type ? item.doc_type.toUpperCase() : `Документ #${item.document_id}`}
              cls="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            />
          }
          statusBadge={<StatusPill label={reqStatusLabel(item.status)} cls={reqStatusCls(item.status)} />}
          date={fmtDate(item.created_at)}
          onClick={() => onSelect(item)}
        />
      ))}
    </div>
  )
}

// Резолв ID администратора в имя/логин. GET /admin/admins доступен только
// суперадмину, поэтому: своё имя видно всегда, для остальных — резолв по
// списку админов (только суперадмин), иначе fallback на "Администратор #ID".
function useAdminDisplayName(adminId: number | null): string {
  const currentUser = useAuthStore(s => s.user)
  const isSuperadmin = currentUser?.role === 'superadmin'
  const adminsQ = useQuery({
    queryKey: ['admins-for-filter'],
    queryFn: () => usersApi.getAdminList({ size: 100 }),
    enabled: isSuperadmin,
    staleTime: 60_000,
  })
  if (adminId == null) return ''
  if (adminId === currentUser?.id) return currentUser?.full_name ?? currentUser?.login ?? `Администратор #${adminId}`
  const found = adminsQ.data?.items.find(a => a.id === adminId)
  return found ? (found.full_name ?? found.login ?? `Администратор #${adminId}`) : `Администратор #${adminId}`
}

function AdditionDialog({ request, onClose }: { request: AdditionRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [cabinetId, setCabinetId] = useState<number | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)
  const [subProjectId, setSubProjectId] = useState<number | null>(null)
  const resolvedByName = useAdminDisplayName(request.resolved_by_admin_id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['addition-requests'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveAddition(request.id, cabinetId!, approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    // 404 — выбранный ШУ уже не существует (удалили, пока заявка ждала одобрения)
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 404) {
        toast.error('Выбранный ШУ не найден — возможно, его удалили')
      } else toast.error('Ошибка при одобрении')
    },
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectAddition(request.id, rejectNote),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена'); onClose() },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const isPending = request.status === 'pending'

  return (
    <AppModal open onClose={onClose}>
      {/* min-w-0 — без него grid-item (Popup — display:grid) не сжимается ниже
          ширины контента и вылезает шире модалки, см. cabinet-detail-dialog.tsx */}
      <div className="flex flex-col max-h-[85vh] min-w-0">
      <DialogHeader
        icon={<AddModalIcon />}
        title={`Заявка на добавление #${request.id}`}
        subtitle={request.user_full_name ?? '—'}
        badge={
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
            {reqStatusLabel(request.status)}
          </span>
        }
      />
      {/* min-h-0 — иначе flex-1 не сжимается ниже контента и модалка вылезает
          за max-h-[85vh] вместо внутреннего скролла (см. cabinet-detail-dialog.tsx) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRowLink label="Пользователь" value={request.user_full_name ?? `#${request.user_id}`} onClick={() => setSubUserId(request.user_id)} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Тип" value={userTypeLabel(request.user_type)} />
        {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
        <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
        {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
        {request.project_name && <DRowLink label="Проект" value={request.project_name} onClick={() => setSubProjectId(request.project_id!)} />}
        <DRow label="Заявка создана" value={fmtDate(request.created_at)} />
        {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
        {request.resolved_by_admin_id != null && <DRow label="Обработал" value={resolvedByName} />}
        {request.cabinet_id && <DRowLink label="Связанный ШУ" value={`ШУ #${request.cabinet_id}`} onClick={() => setSubCabinetId(request.cabinet_id!)} />}
        {request.user_comment && (
          <DRow label="Комментарий" value={
            <span className="font-normal text-slate-600 dark:text-slate-300">{request.user_comment}</span>
          } />
        )}
        {request.admin_response && (
          <DRow label="Ответ" value={
            <span className="font-normal text-slate-600 dark:text-slate-300">{request.admin_response}</span>
          } />
        )}
      </div>

      {request.photo_url && (
        <div className="px-4 sm:px-6 pb-4 pt-3">
          <p className="text-xs text-slate-400 mb-2">Фото</p>
          <img
            src={toFullUrl(request.photo_url)}
            alt="Фото заявки"
            className="max-h-56 rounded-xl object-contain border border-slate-200 dark:border-slate-700"
          />
        </div>
      )}
      </div>

      <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700">
        {!isPending ? null : action === null ? (
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setAction('reject')} className="bg-red-500 hover:bg-red-600 cursor-pointer">Отклонить</Button>
            <Button onClick={() => setAction('approve')} className="bg-green-600 hover:bg-green-700 cursor-pointer">Одобрить</Button>
          </div>
        ) : action === 'approve' ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Шкаф управления <span className="text-red-500">*</span>
              </label>
              <CabinetCombobox value={cabinetId} onChange={setCabinetId} />
              {request.project_name && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Если выбранный ШУ ничей — он привяжется к проекту «{request.project_name}»,
                  и весь проект сразу получит к нему доступ. Если ШУ уже в другом проекте —
                  одобрение вернёт ошибку, сначала отвязать вручную.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
              <ModalTextarea value={approveNote} onChange={setApproveNote} placeholder="Необязательно" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => approveMut.mutate()}
                disabled={cabinetId == null || approveMut.isPending}
                className="bg-green-600 hover:bg-green-700 cursor-pointer"
              >
                {approveMut.isPending ? 'Обработка...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Причина отклонения <span className="text-red-500">*</span>
              </label>
              <ModalTextarea value={rejectNote} onChange={setRejectNote} placeholder="Обязательно укажите причину" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => rejectMut.mutate()}
                disabled={!rejectNote.trim() || rejectMut.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {rejectMut.isPending ? 'Обработка...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin onClose={() => setSubCabinetId(null)} />}
      {subProjectId !== null && <ProjectDetailDialog projectId={subProjectId} isAdmin onClose={() => setSubProjectId(null)} />}
    </AppModal>
  )
}

function ProjectRequestDialog({ request, onClose }: { request: ProjectRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role !== 'operator'
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subProjectId, setSubProjectId] = useState<number | null>(null)
  const resolvedByName = useAdminDisplayName(request.resolved_by_admin_id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['project-requests'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveProjectRequest(request.id, approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    // 404 — проект удалили после подачи заявки; одобрить такую заявку уже нельзя, только отклонить
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 404) {
        invalidate()
        toast.error('Проект этой заявки уже удалён — одобрение невозможно, заявку можно отклонить')
      } else toast.error('Ошибка при одобрении')
    },
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectProjectRequest(request.id, rejectNote),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена'); onClose() },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const isPending = request.status === 'pending'

  return (
    <AppModal open onClose={onClose}>
      {/* min-w-0 — без него grid-item (Popup — display:grid) не сжимается ниже
          ширины контента и вылезает шире модалки, см. cabinet-detail-dialog.tsx */}
      <div className="flex flex-col max-h-[85vh] min-w-0">
      <DialogHeader
        icon={<ProjectRequestModalIcon />}
        title={`Заявка на проект #${request.id}`}
        subtitle={request.user_full_name ?? '—'}
        badge={
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
            {reqStatusLabel(request.status)}
          </span>
        }
      />
      {/* min-h-0 — иначе flex-1 не сжимается ниже контента и модалка вылезает
          за max-h-[85vh] вместо внутреннего скролла (см. cabinet-detail-dialog.tsx) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRowLink label="Пользователь" value={request.user_full_name ?? `#${request.user_id}`} onClick={() => setSubUserId(request.user_id)} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Тип" value={userTypeLabel(request.user_type)} />
        {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
        <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
        {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
        <DRowLink label="Проект" value={request.project_name} onClick={() => setSubProjectId(request.project_id)} />
        <DRow label="Заявка создана" value={fmtDate(request.created_at)} />
        {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
        {request.resolved_by_admin_id != null && <DRow label="Обработал" value={resolvedByName} />}
        {request.user_comment && (
          <DRow label="Комментарий" value={
            <span className="font-normal text-slate-600 dark:text-slate-300">{request.user_comment}</span>
          } />
        )}
        {request.admin_response && (
          <DRow label="Ответ" value={
            <span className="font-normal text-slate-600 dark:text-slate-300">{request.admin_response}</span>
          } />
        )}
      </div>
      </div>

      <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700">
        {!isPending ? null : action === null ? (
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setAction('reject')} className="bg-red-500 hover:bg-red-600 cursor-pointer">Отклонить</Button>
            <Button onClick={() => setAction('approve')} className="bg-green-600 hover:bg-green-700 cursor-pointer">Одобрить</Button>
          </div>
        ) : action === 'approve' ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
              <ModalTextarea value={approveNote} onChange={setApproveNote} placeholder="Необязательно" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending}
                className="bg-green-600 hover:bg-green-700 cursor-pointer"
              >
                {approveMut.isPending ? 'Обработка...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Причина отклонения <span className="text-red-500">*</span>
              </label>
              <ModalTextarea value={rejectNote} onChange={setRejectNote} placeholder="Обязательно укажите причину" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => rejectMut.mutate()}
                disabled={!rejectNote.trim() || rejectMut.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {rejectMut.isPending ? 'Обработка...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
      {subProjectId !== null && <ProjectDetailDialog projectId={subProjectId} isAdmin={isAdmin} onClose={() => setSubProjectId(null)} />}
    </AppModal>
  )
}

function PhoneChangeDialog({ request, onClose }: { request: PhoneChangeRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  // Просмотр доступен оператору, решение — только админу (см. README-backend.md)
  const canDecide = currentUser?.role !== 'operator'
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const resolvedByName = useAdminDisplayName(request.resolved_by_admin_id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['phone-change-requests'] })
    qc.invalidateQueries({ queryKey: ['admin-users'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approvePhoneChangeRequest(request.id, approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Номер изменён'); onClose() },
    // Занятость номера перепроверяется на момент одобрения: владелец мог
    // зарегистрироваться сам, пока заявка ждала
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 409) {
        invalidate()
        toast.error('Номер уже занят другим пользователем — одобрить нельзя')
      } else toast.error('Ошибка при одобрении')
    },
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectPhoneChangeRequest(request.id, rejectNote),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена'); onClose() },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const isPending = request.status === 'pending'
  const hasRivals = isPending && request.pending_rivals > 1

  return (
    <AppModal open onClose={onClose}>
      <div className="flex flex-col max-h-[85vh] min-w-0">
      <DialogHeader
        icon={<PhoneChangeModalIcon />}
        title={`Смена номера #${request.id}`}
        subtitle={request.user_full_name ?? '—'}
        badge={
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
            {reqStatusLabel(request.status)}
          </span>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {hasRivals && (
          <div className="mx-4 sm:mx-6 mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400 flex items-start gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              На этот номер претендует несколько аккаунтов — необработанных заявок: {request.pending_rivals}.
              Разберитесь, чья он на самом деле, прежде чем одобрять.
            </p>
          </div>
        )}

        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-slate-400 line-through">{request.old_phone ?? '—'}</span>
            <span className="text-slate-400">→</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100">{request.new_phone}</span>
          </div>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          <DRowLink label="Пользователь" value={request.user_full_name ?? `#${request.user_id}`} onClick={() => setSubUserId(request.user_id)} />
          <DRow label="Тип" value={userTypeLabel(request.user_type)} />
          {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
          <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
          {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
          <DRow label="Заявка создана" value={fmtDate(request.created_at)} />
          {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
          {request.resolved_by_admin_id != null && <DRow label="Обработал" value={resolvedByName} />}
          {request.user_comment && (
            <DRow label="Обоснование" value={
              <span className="font-normal text-slate-600 dark:text-slate-300">{request.user_comment}</span>
            } />
          )}
          {request.admin_response && (
            <DRow label="Ответ" value={
              <span className="font-normal text-slate-600 dark:text-slate-300">{request.admin_response}</span>
            } />
          )}
        </div>
      </div>

      {isPending && canDecide && (
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700">
          {action === null ? (
            <>
              {/* Система владение номером не проверяет — это делает администратор
                  вне системы. Одобрение меняет логин пользователя немедленно. */}
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-3 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Система не проверяет, принадлежит ли номер заявителю. Подтвердите владение
                сами — звонком или документами. После одобрения вход будет по новому номеру.
              </p>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => setAction('reject')} className="bg-red-500 hover:bg-red-600 cursor-pointer">Отклонить</Button>
                <Button onClick={() => setAction('approve')} className="bg-green-600 hover:bg-green-700 cursor-pointer">Одобрить</Button>
              </div>
            </>
          ) : action === 'approve' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
                <ModalTextarea value={approveNote} onChange={setApproveNote} placeholder="Например: проверено звонком" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
                <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending} className="bg-green-600 hover:bg-green-700 cursor-pointer">
                  {approveMut.isPending ? 'Обработка...' : 'Подтвердить'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  Причина отклонения <span className="text-red-500">*</span>
                </label>
                <ModalTextarea value={rejectNote} onChange={setRejectNote} placeholder="Причина уйдёт пользователю в уведомлении" rows={3} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
                <Button onClick={() => rejectMut.mutate()} disabled={!rejectNote.trim() || rejectMut.isPending} className="bg-red-500 hover:bg-red-600 cursor-pointer">
                  {rejectMut.isPending ? 'Обработка...' : 'Подтвердить'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
    </AppModal>
  )
}

function DocumentRequestDialog({ request, onClose }: { request: DocumentRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)
  const [subProjectId, setSubProjectId] = useState<number | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['document-requests'] })

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveDocumentRequest(request.id, approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    onError: () => toast.error('Ошибка при одобрении'),
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectDocumentRequest(request.id, rejectNote),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена'); onClose() },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const isPending = request.status === 'pending'

  return (
    <AppModal open onClose={onClose}>
      {/* min-w-0 — без него grid-item (Popup — display:grid) не сжимается ниже
          ширины контента и вылезает шире модалки, см. cabinet-detail-dialog.tsx */}
      <div className="flex flex-col max-h-[85vh] min-w-0">
      <DialogHeader
        icon={<DocRequestModalIcon />}
        title={`Заявка на документ #${request.id}`}
        subtitle={request.user_full_name ?? '—'}
        badge={
          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
            {reqStatusLabel(request.status)}
          </span>
        }
      />
      {/* min-h-0 — иначе flex-1 не сжимается ниже контента и модалка вылезает
          за max-h-[85vh] вместо внутреннего скролла (см. cabinet-detail-dialog.tsx) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRowLink label="Пользователь" value={request.user_full_name ?? `#${request.user_id}`} onClick={() => setSubUserId(request.user_id)} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Тип" value={userTypeLabel(request.user_type)} />
        {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
        <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
        {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
        {request.document_id && (
          <DRow label="Документ" value={
            <span>
              #{request.document_id}
              {request.doc_type && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-xs text-slate-500 dark:text-slate-400 font-normal">
                  {request.doc_type.toUpperCase()}
                </span>
              )}
            </span>
          } />
        )}
        {request.cabinet_id && <DRowLink label="Шкаф" value={`ШУ #${request.cabinet_id}`} onClick={() => setSubCabinetId(request.cabinet_id!)} />}
        {request.project_id && <DRowLink label="Проект" value={`Проект #${request.project_id}`} onClick={() => setSubProjectId(request.project_id!)} />}
        <DRow label="Создана" value={fmtDate(request.created_at)} />
        {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
        {request.resolved_by_admin_id != null && <DRow label="Обработал" value={`Администратор #${request.resolved_by_admin_id}`} />}
        {request.user_message && (
          <DRow label="Сообщение" value={
            <span className="font-normal text-slate-600 dark:text-slate-300">{request.user_message}</span>
          } />
        )}
        {request.admin_response && (
          <DRow label="Ответ" value={
            <span className="font-normal text-slate-600 dark:text-slate-300">{request.admin_response}</span>
          } />
        )}
      </div>
      </div>

      <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700">
        {!isPending ? null : action === null ? (
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setAction('reject')} className="bg-red-500 hover:bg-red-600 cursor-pointer">Отклонить</Button>
            <Button onClick={() => setAction('approve')} className="bg-green-600 hover:bg-green-700 cursor-pointer">Одобрить</Button>
          </div>
        ) : action === 'approve' ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
              <ModalTextarea value={approveNote} onChange={setApproveNote} placeholder="Необязательно" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => approveMut.mutate()}
                disabled={approveMut.isPending}
                className="bg-green-600 hover:bg-green-700 cursor-pointer"
              >
                {approveMut.isPending ? 'Обработка...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Причина отклонения <span className="text-red-500">*</span>
              </label>
              <ModalTextarea value={rejectNote} onChange={setRejectNote} placeholder="Обязательно укажите причину" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => rejectMut.mutate()}
                disabled={!rejectNote.trim() || rejectMut.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {rejectMut.isPending ? 'Обработка...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin onClose={() => setSubCabinetId(null)} />}
      {subProjectId !== null && <ProjectDetailDialog projectId={subProjectId} isAdmin onClose={() => setSubProjectId(null)} />}
    </AppModal>
  )
}

function ListIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
}
function GridIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}
function AddModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
}
function DocRequestModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
}
function DocRequestCardIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
}
function PhoneChangeModalIcon() {
  return <Phone className="w-6 h-6 text-white" strokeWidth={1.5} />
}
function PhoneChangeCardIcon() {
  return <Phone className="w-6 h-6 text-white" strokeWidth={1.5} />
}
function ProjectRequestModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 015.25 3.75h5.379a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18.75A2.25 2.25 0 0121 9v.776" /></svg>
}
function ProjectRequestCardIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 015.25 3.75h5.379a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18.75A2.25 2.25 0 0121 9v.776" /></svg>
}
