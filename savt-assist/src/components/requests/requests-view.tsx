'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { X, ClipboardList, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toFullUrl } from '@/lib/api/base-url'
import { requestsApi } from '@/lib/api/requests'
import type { ServiceRequest, AdditionRequest, ShareRequest, DocumentRequest } from '@/lib/api/requests'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/lib/store/auth'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { RequestCard, ServiceCardIcon, AdditionCardIcon, ShareCardIcon, StatusPill, TypePill } from './request-card'
import { UserDialog } from '@/components/users/user-dialog'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { ServiceDialog } from './service-dialog'
import {
  DRow, DRowLink, ModalTextarea, DialogHeader, VerifiedBadge,
  svcStatusCls, svcStatusLabel, reqStatusCls, reqStatusLabel, reqTypeCls, reqTypeLabel,
  userTypeLabel, fmtDate,
} from './request-shared'

type Tab = 'service' | 'additions' | 'shares' | 'docs'

// Сетка карточек заявок: 1 колонка на самых узких, до 4 на широких мониторах
const GRID_CLASSES = 'grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'

const TABS: { id: Tab; label: string }[] = [
  { id: 'service', label: 'Сервисные' },
  { id: 'additions', label: 'Добавление ШУ' },
  { id: 'shares', label: 'Доступ к ШУ' },
  { id: 'docs', label: 'Документы' },
]

const SVC_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'open', label: 'Открытые' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'closed', label: 'Закрытые' },
]
const REQ_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Ожидают' },
  { value: 'approved', label: 'Одобренные' },
  { value: 'rejected', label: 'Отклонённые' },
]

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
const SHARES_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'resolved_at', label: 'По рассмотрению' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'cabinet_object_number', label: 'По ШУ' },
]
const DOC_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'resolved_at', label: 'По рассмотрению' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'doc_type', label: 'По типу' },
]

const REQUEST_TYPE_FILTERS = [
  { value: 'all', label: 'Все типы' },
  { value: 'repair', label: 'Ремонт' },
  { value: 'maintenance', label: 'Обслуживание' },
  { value: 'inspection', label: 'Осмотр' },
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
  const [selectedShare, setSelectedShare] = useState<ShareRequest | null>(null)
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
  const shrQ = useInfiniteQuery({
    queryKey: ['share-requests', sp, sq, sortBy, sortOrder, resolvedByAdminId],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getShares({ status: sp, search: sq, resolved_by_admin_id: resolvedByAdminId ?? undefined, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'shares',
  })
  const docQ = useInfiniteQuery({
    queryKey: ['document-requests', sp, sq, sortBy, sortOrder, resolvedByAdminId],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getDocumentRequests({ status: sp, search: sq, resolved_by_admin_id: resolvedByAdminId ?? undefined, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'docs',
  })

  const curQ = tab === 'service' ? svcQ : tab === 'additions' ? addQ : tab === 'shares' ? shrQ : docQ
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
  const shrItems = shrQ.data?.pages.flatMap(p => p.items) ?? []
  const docItems = docQ.data?.pages.flatMap(p => p.items) ?? []

  const filters = tab === 'service' ? SVC_FILTERS : REQ_FILTERS
  const sortOptions =
    tab === 'service' ? SVC_SORT :
    tab === 'additions' ? ADDITIONS_SORT :
    tab === 'shares' ? SHARES_SORT :
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
        {tab === 'shares' && !shrQ.isLoading && !shrQ.isError && (
          <SharesList items={shrItems} onSelect={setSelectedShare} view={view} />
        )}
        {tab === 'docs' && !docQ.isLoading && !docQ.isError && (
          <DocumentRequestList items={docItems} onSelect={setSelectedDocRequest} view={view} />
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
      {selectedShare && <ShareDialog request={selectedShare} onClose={() => setSelectedShare(null)} />}
      {selectedDocRequest && <DocumentRequestDialog request={selectedDocRequest} onClose={() => setSelectedDocRequest(null)} />}
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
          title={`ШУ ${item.cabinet_object_number}`}
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
          subtitle={item.user_phone ?? '—'}
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

function SharesList({ items, onSelect, view }: { items: ShareRequest[]; onSelect: (r: ShareRequest) => void; view: ViewMode }) {
  if (!items.length) return <Empty text="Нет заявок на доступ" />
  return (
    <div className={gridCls(view)}>
      {items.map(item => (
        <RequestCard
          key={item.id}
          view={view}
          icon={<ShareCardIcon />}
          title={item.user_full_name ?? '—'}
          subtitle={`ШУ ${item.cabinet_object_number}`}
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
          subtitle={item.cabinet_id ? `ШУ #${item.cabinet_id}` : '—'}
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
  const [cabinetId, setCabinetId] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)
  const resolvedByName = useAdminDisplayName(request.resolved_by_admin_id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['addition-requests'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveAddition(request.id, parseInt(cabinetId), approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    // 404 — указанный ШУ не существует (опечатка в ID или ШУ удалили, пока заявка ждала одобрения)
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 404) {
        toast.error('ШУ с таким ID не найден — проверьте ID или создайте ШУ заново')
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
                ID шкафа управления <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={cabinetId}
                onChange={e => setCabinetId(e.target.value)}
                placeholder="Введите ID ШУ"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Комментарий</label>
              <ModalTextarea value={approveNote} onChange={setApproveNote} placeholder="Необязательно" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAction(null)} className="cursor-pointer">Назад</Button>
              <Button
                onClick={() => approveMut.mutate()}
                disabled={!cabinetId || approveMut.isPending}
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
    </AppModal>
  )
}

function ShareDialog({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)
  const resolvedByName = useAdminDisplayName(request.resolved_by_admin_id)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['share-requests'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveShare(request.id, approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    // 404 — ШУ удалили после подачи заявки; одобрить такую заявку уже нельзя, только отклонить
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 404) {
        invalidate()
        toast.error('ШУ этой заявки уже удалён — одобрение невозможно, заявку можно отклонить')
      } else toast.error('Ошибка при одобрении')
    },
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectShare(request.id, rejectNote),
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
        icon={<ShareModalIcon />}
        title={`Заявка на доступ #${request.id}`}
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
        <DRowLink label="Шкаф" value={`ШУ ${request.cabinet_object_number}`} onClick={() => setSubCabinetId(request.cabinet_id)} />
        <DRow label="Тип ШУ" value={request.cabinet_type} />
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
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin onClose={() => setSubCabinetId(null)} />}
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
function ShareModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
}
function DocRequestModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
}
function DocRequestCardIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
}
