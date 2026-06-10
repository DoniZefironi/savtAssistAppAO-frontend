'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { API_URL } from '@/lib/api/client'
import { requestsApi } from '@/lib/api/requests'
import type { ServiceRequest, AdditionRequest, ShareRequest, DocumentRequest } from '@/lib/api/requests'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { RequestCard, ServiceCardIcon, AdditionCardIcon, ShareCardIcon, StatusPill, TypePill } from './request-card'

type Tab = 'service' | 'additions' | 'shares' | 'docs'

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
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'cabinet_object_number', label: 'По ШУ' },
  { value: 'request_type', label: 'По типу' },
]
const ADDITIONS_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
]
const SHARES_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'cabinet_object_number', label: 'По ШУ' },
]
const DOC_SORT = [
  { value: 'created_at', label: 'По дате' },
  { value: 'status', label: 'По статусу' },
  { value: 'user_full_name', label: 'По имени' },
  { value: 'doc_type', label: 'По типу' },
]

function svcStatusCls(s: string) {
  return s === 'open'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : s === 'in_progress'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
}
function svcStatusLabel(s: string) {
  return s === 'open' ? 'Открыта' : s === 'in_progress' ? 'В работе' : 'Закрыта'
}
function reqStatusCls(s: string) {
  return s === 'pending'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : s === 'approved'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}
function reqStatusLabel(s: string) {
  return s === 'pending' ? 'Ожидает' : s === 'approved' ? 'Одобрена' : 'Отклонена'
}
function reqTypeCls(t: string) {
  if (t === 'maintenance') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  if (t === 'inspection') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (t === 'other') return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
  return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
}
function reqTypeLabel(t: string) {
  if (t === 'maintenance') return 'Обслуживание'
  if (t === 'inspection') return 'Осмотр'
  if (t === 'other') return 'Другое'
  return 'Ремонт'
}
function userTypeLabel(t: string | null) {
  return t === 'organization' ? 'Организация' : 'Физ. лицо'
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function toFullUrl(url: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_URL}${url}`
}

export function RequestsView() {
  const [tab, setTab] = useState<Tab>('service')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
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

  const svcQ = useInfiniteQuery({
    queryKey: ['service-requests', sp, sq, sortBy, sortOrder],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getServiceRequests({ status: sp, search: sq, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'service',
  })
  const addQ = useInfiniteQuery({
    queryKey: ['addition-requests', sp, sq, sortBy, sortOrder],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getAdditions({ status: sp, search: sq, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'additions',
  })
  const shrQ = useInfiniteQuery({
    queryKey: ['share-requests', sp, sq, sortBy, sortOrder],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getShares({ status: sp, search: sq, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'shares',
  })
  const docQ = useInfiniteQuery({
    queryKey: ['document-requests', sp, sq, sortBy, sortOrder],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      requestsApi.getDocumentRequests({ status: sp, search: sq, sort_by: sortBy, sort_order: sortOrder, page: pageParam, size: 20 }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    enabled: tab === 'docs',
  })

  const curQ = tab === 'service' ? svcQ : tab === 'additions' ? addQ : tab === 'shares' ? shrQ : docQ
  const total = curQ.data?.pages[0]?.total

  // Infinite scroll sentinel
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
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60">
        <div className="mb-4">
          {total != null && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} заявок</p>}
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Заявки</h1>
        </div>
        <div className="flex gap-0 -mb-px">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
                tab === t.id
                  ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters / search / sort ── */}
      <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center gap-2">
        <div className="relative mr-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск..."
            className="pl-8 pr-3 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7] w-52"
          />
        </div>

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

        {sortOptions.length > 0 && (
          <>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
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

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50 dark:bg-slate-900">
        {curQ.isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
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
          <ServiceList items={svcItems} onSelect={setSelectedService} />
        )}
        {tab === 'additions' && !addQ.isLoading && !addQ.isError && (
          <AdditionsList items={addItems} onSelect={setSelectedAddition} />
        )}
        {tab === 'shares' && !shrQ.isLoading && !shrQ.isError && (
          <SharesList items={shrItems} onSelect={setSelectedShare} />
        )}
        {tab === 'docs' && !docQ.isLoading && !docQ.isError && (
          <DocumentRequestList items={docItems} onSelect={setSelectedDocRequest} />
        )}

        {/* Infinite scroll sentinel */}
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

      {selectedService && <ServiceDialog request={selectedService} onClose={() => setSelectedService(null)} />}
      {selectedAddition && <AdditionDialog request={selectedAddition} onClose={() => setSelectedAddition(null)} />}
      {selectedShare && <ShareDialog request={selectedShare} onClose={() => setSelectedShare(null)} />}
      {selectedDocRequest && <DocumentRequestDialog request={selectedDocRequest} onClose={() => setSelectedDocRequest(null)} />}
    </div>
  )
}

// ─── List rows ──────────────────────────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-slate-400">
      <p className="text-2xl mb-2">📋</p>
      <p>{text}</p>
    </div>
  )
}

function ServiceList({ items, onSelect }: { items: ServiceRequest[]; onSelect: (r: ServiceRequest) => void }) {
  if (!items.length) return <Empty text="Нет сервисных заявок" />
  return (
    <div className="space-y-2">
      {items.map(item => (
        <RequestCard
          key={item.id}
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

function AdditionsList({ items, onSelect }: { items: AdditionRequest[]; onSelect: (r: AdditionRequest) => void }) {
  if (!items.length) return <Empty text="Нет заявок на добавление" />
  return (
    <div className="space-y-2">
      {items.map(item => (
        <RequestCard
          key={item.id}
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

function SharesList({ items, onSelect }: { items: ShareRequest[]; onSelect: (r: ShareRequest) => void }) {
  if (!items.length) return <Empty text="Нет заявок на доступ" />
  return (
    <div className="space-y-2">
      {items.map(item => (
        <RequestCard
          key={item.id}
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

function DocumentRequestList({ items, onSelect }: { items: DocumentRequest[]; onSelect: (r: DocumentRequest) => void }) {
  if (!items.length) return <Empty text="Нет заявок на документы" />
  return (
    <div className="space-y-2">
      {items.map(item => (
        <RequestCard
          key={item.id}
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

// ─── Dialogs ────────────────────────────────────────────────────────────────

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-6 py-3">
      <span className="text-xs text-slate-400 w-32 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}

function ModalTextarea({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:border-[#4A8FE7] dark:placeholder:text-slate-500"
    />
  )
}

function DialogHeader({ icon, title, subtitle, badge }: {
  icon: React.ReactNode; title: string; subtitle: string; badge?: React.ReactNode
}) {
  return (
    <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg text-white leading-tight">{title}</p>
          <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>
          {badge && <div className="mt-2">{badge}</div>}
        </div>
      </div>
    </div>
  )
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      verified
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
    )}>
      {verified ? '✓ Подтверждён' : 'Не подтверждён'}
    </span>
  )
}

function ServiceDialog({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(request.status)

  const mutation = useMutation({
    mutationFn: () => requestsApi.updateServiceRequestStatus(request.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-requests'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Статус обновлён')
      onClose()
    },
    onError: () => toast.error('Не удалось обновить статус'),
  })

  return (
    <AppModal open onClose={onClose}>
      <DialogHeader
        icon={<WrenchModalIcon />}
        title={`Заявка #${request.id}`}
        subtitle={`ШУ ${request.cabinet_object_number}`}
        badge={
          <div className="flex gap-1.5 flex-wrap">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              {svcStatusLabel(request.status)}
            </span>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              {reqTypeLabel(request.request_type)}
            </span>
          </div>
        }
      />
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRow label="Пользователь" value={request.user_full_name ?? '—'} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Создана" value={fmtDate(request.created_at)} />
        <DRow label="Закрыта" value={request.closed_at ? fmtDate(request.closed_at) : '—'} />
        <div className="flex gap-4 px-6 py-3">
          <span className="text-xs text-slate-400 w-32 shrink-0 pt-0.5">Описание</span>
          <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {request.description}
          </p>
        </div>
      </div>
      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 mb-2">Изменить статус</p>
        <div className="flex gap-2 mb-4">
          {(['open', 'in_progress', 'closed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex-1 cursor-pointer',
                status === s
                  ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
              )}
            >
              {svcStatusLabel(s)}
            </button>
          ))}
        </div>
        {status !== request.status && (
          <div className="flex justify-end">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        )}
      </div>
    </AppModal>
  )
}

function AdditionDialog({ request, onClose }: { request: AdditionRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [cabinetId, setCabinetId] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['addition-requests'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveAddition(request.id, parseInt(cabinetId), approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    onError: () => toast.error('Ошибка при одобрении'),
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectAddition(request.id, rejectNote),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена'); onClose() },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const isPending = request.status === 'pending'

  return (
    <AppModal open onClose={onClose}>
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
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRow label="Пользователь" value={request.user_full_name ?? '—'} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Тип" value={userTypeLabel(request.user_type)} />
        {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
        <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
        {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
        <DRow label="Заявка создана" value={fmtDate(request.created_at)} />
        {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
        {request.cabinet_id && <DRow label="Связанный ШУ" value={`#${request.cabinet_id}`} />}
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
        <div className="px-6 pb-4">
          <p className="text-xs text-slate-400 mb-2">Фото</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toFullUrl(request.photo_url)}
            alt="Фото заявки"
            className="max-h-56 rounded-xl object-contain border border-slate-200 dark:border-slate-700"
          />
        </div>
      )}

      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700">
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
    </AppModal>
  )
}

function ShareDialog({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['share-requests'] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const approveMut = useMutation({
    mutationFn: () => requestsApi.approveShare(request.id, approveNote || null),
    onSuccess: () => { invalidate(); toast.success('Заявка одобрена'); onClose() },
    onError: () => toast.error('Ошибка при одобрении'),
  })
  const rejectMut = useMutation({
    mutationFn: () => requestsApi.rejectShare(request.id, rejectNote),
    onSuccess: () => { invalidate(); toast.success('Заявка отклонена'); onClose() },
    onError: () => toast.error('Ошибка при отклонении'),
  })

  const isPending = request.status === 'pending'

  return (
    <AppModal open onClose={onClose}>
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
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRow label="Пользователь" value={request.user_full_name ?? '—'} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Тип" value={userTypeLabel(request.user_type)} />
        {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
        <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
        {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
        <DRow label="Шкаф" value={`ШУ ${request.cabinet_object_number}`} />
        <DRow label="Тип ШУ" value={request.cabinet_type} />
        <DRow label="Заявка создана" value={fmtDate(request.created_at)} />
        {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
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

      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700">
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
    </AppModal>
  )
}

function DocumentRequestDialog({ request, onClose }: { request: DocumentRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectNote, setRejectNote] = useState('')

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
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRow label="Пользователь" value={request.user_full_name ?? '—'} />
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
        {request.cabinet_id && <DRow label="Шкаф" value={`ШУ #${request.cabinet_id}`} />}
        <DRow label="Создана" value={fmtDate(request.created_at)} />
        {request.resolved_at && <DRow label="Рассмотрена" value={fmtDate(request.resolved_at)} />}
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

      <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700">
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
    </AppModal>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}
function WrenchModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
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
