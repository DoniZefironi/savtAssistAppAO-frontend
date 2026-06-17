'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usersApi } from '@/lib/api/users'
import type { AdminUser } from '@/lib/api/users'
import { useAuthStore } from '@/lib/store/auth'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { RequestCard, StatusPill, TypePill } from '@/components/requests/request-card'

const STATUS_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'banned', label: 'Заблокированные' },
]

const SORT_OPTIONS = [
  { value: 'created_at', label: 'По дате' },
  { value: 'full_name', label: 'По имени' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']
type RoleTab = 'user' | 'operator' | 'admin'

function roleLabel(r: string) {
  if (r === 'superadmin') return 'Суперадмин'
  if (r === 'admin') return 'Администратор'
  if (r === 'operator') return 'Оператор'
  return 'Пользователь'
}
function roleCls(r: string) {
  if (r === 'superadmin') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (r === 'admin') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  if (r === 'operator') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
}
function activeCls(a: boolean) {
  return a
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}
function userTypeLabel(t: string | null) {
  if (t === 'organization') return 'Организация'
  if (t === 'individual') return 'Физ. лицо'
  return t ?? '—'
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function userName(u: AdminUser) {
  return u.full_name ?? u.login ?? u.phone ?? `#${u.id}`
}
function userSubtitle(u: AdminUser) {
  if (u.full_name) return u.phone ?? u.login ?? '—'
  if (u.login) return u.phone ?? '—'
  return '—'
}

function getListFn(role: RoleTab) {
  if (role === 'operator') return usersApi.getOperatorList
  if (role === 'admin') return usersApi.getAdminList
  return usersApi.getUserList
}

export function UsersView() {
  const currentUser = useAuthStore(s => s.user)
  const isSuperadmin = currentUser?.role === 'superadmin'

  const [roleTab, setRoleTab] = useState<RoleTab>('user')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  useEffect(() => {
    const saved = localStorage.getItem('view-mode-users')
    if (saved === 'list' || saved === 'grid') setView(saved)
  }, [])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [createOperatorOpen, setCreateOperatorOpen] = useState(false)
  const [createAdminOpen, setCreateAdminOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset filters when role tab changes
  useEffect(() => {
    setStatusFilter('all')
    setSearchInput('')
    setSearch('')
    setSortBy('created_at')
    setSortOrder('desc')
  }, [roleTab])

  const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active'

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['admin-users', roleTab, statusFilter, sortBy, sortOrder, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      getListFn(roleTab)({
        is_active: isActive,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: 20,
      }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
  })

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleSortClick = (val: SortValue) => {
    if (sortBy === val) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(val); setSortOrder('desc') }
  }

  const allItems = data?.pages.flatMap(p => p.items) ?? []
  const total = data?.pages[0]?.total

  const ROLE_TABS: { value: RoleTab; label: string }[] = [
    { value: 'user', label: 'Пользователи' },
    { value: 'operator', label: 'Операторы' },
    ...(isSuperadmin ? [{ value: 'admin' as RoleTab, label: 'Администраторы' }] : []),
  ]

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            {total != null && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{total} записей</p>
            )}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Пользователи</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button onClick={() => { setView('list'); localStorage.setItem('view-mode-users', 'list') }} title="Список" className={`p-2 transition-colors cursor-pointer ${view === 'list' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ListIcon /></button>
              <button onClick={() => { setView('grid'); localStorage.setItem('view-mode-users', 'grid') }} title="Сетка" className={`p-2 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${view === 'grid' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><GridIcon /></button>
            </div>
            {isSuperadmin && (
              <Button onClick={() => setCreateAdminOpen(true)} className="bg-purple-600 hover:bg-purple-700 cursor-pointer">
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Создать администратора
              </Button>
            )}
            <Button onClick={() => setCreateOperatorOpen(true)} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
              <PlusIcon className="w-4 h-4 mr-1.5" />
              Создать оператора
            </Button>
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex gap-0 -mb-px">
          {ROLE_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setRoleTab(t.value)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
                roleTab === t.value
                  ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по имени, телефону, логину..."
            className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
          />
          {searchInput && (
            <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">✕</button>
          )}
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0 flex flex-wrap items-center gap-2">
        {/* Status filter */}
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
              statusFilter === f.value
                ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            )}
          >
            {f.label}
          </button>
        ))}

        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        {/* Sort */}
        {SORT_OPTIONS.map(opt => {
          const active = sortBy === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleSortClick(opt.value)}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                active
                  ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              )}
            >
              {opt.label}
              {active && <span className="opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
            </button>
          )
        })}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50 dark:bg-slate-900">
        {isLoading && (
          <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
            {[1, 2, 3, 4].map(i => <div key={i} className={`bg-white dark:bg-slate-800 rounded-xl animate-pulse ${view === 'grid' ? 'h-36' : 'h-20'}`} />)}
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить пользователей</p>
            <button onClick={() => refetch()} className="text-sm text-[#1B3A72] hover:underline cursor-pointer">Повторить</button>
          </div>
        )}
        {!isLoading && !isError && allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <p className="text-2xl mb-2">👥</p>
            <p>Пользователей не найдено</p>
          </div>
        )}
        {allItems.length > 0 && (
          <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
            {allItems.map(user => (
              <RequestCard
                key={user.id}
                view={view}
                icon={<UserIcon />}
                title={userName(user)}
                subtitle={userSubtitle(user)}
                meta={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <TypePill label={roleLabel(user.role)} cls={roleCls(user.role)} />
                    {user.organization_name && (
                      <TypePill label={user.organization_name} cls="bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400" />
                    )}
                  </div>
                }
                statusBadge={
                  <StatusPill
                    label={user.is_active ? 'Активен' : 'Заблокирован'}
                    cls={activeCls(user.is_active)}
                  />
                }
                date={fmtDate(user.created_at)}
                onClick={() => setSelectedUser(user)}
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
        {!hasNextPage && (total ?? 0) > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
            Все {total} записей загружены
          </p>
        )}
      </div>

      {selectedUser && (
        <UserDialog userId={selectedUser.id} role={selectedUser.role} onClose={() => setSelectedUser(null)} />
      )}
      {createOperatorOpen && <CreateOperatorModal onClose={() => setCreateOperatorOpen(false)} />}
      {createAdminOpen && <CreateStaffModal onClose={() => setCreateAdminOpen(false)} />}
    </div>
  )
}

// ─── User detail dialog ────────────────────────────────────────────────────

function UserDialog({ userId, role, onClose }: { userId: number; role: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [banStep, setBanStep] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [deleteStep, setDeleteStep] = useState(false)

  // Admins/superadmins don't have a detail endpoint — show limited info
  const canFetchDetail = role === 'user' || role === 'operator'

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => usersApi.getOne(userId),
    enabled: canFetchDetail,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] })
    qc.invalidateQueries({ queryKey: ['admin-user', userId] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const verifyMut = useMutation({
    mutationFn: () => usersApi.verify(userId),
    onSuccess: () => { invalidate(); toast.success('Верификация выдана') },
    onError: () => toast.error('Ошибка при верификации'),
  })
  const unverifyMut = useMutation({
    mutationFn: () => usersApi.unverify(userId),
    onSuccess: () => { invalidate(); toast.success('Верификация снята') },
    onError: () => toast.error('Ошибка'),
  })
  const banMut = useMutation({
    mutationFn: () => usersApi.ban(userId, banReason),
    onSuccess: () => { invalidate(); toast.success('Пользователь заблокирован'); setBanStep(false); setBanReason(''); onClose() },
    onError: () => toast.error('Ошибка при блокировке'),
  })
  const unbanMut = useMutation({
    mutationFn: () => usersApi.unban(userId),
    onSuccess: () => { invalidate(); toast.success('Пользователь разблокирован') },
    onError: () => toast.error('Ошибка при разблокировке'),
  })
  const deleteOperatorMut = useMutation({
    mutationFn: () => usersApi.deleteOperator(userId),
    onSuccess: () => { invalidate(); toast.success('Оператор удалён'); onClose() },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const isMutating = verifyMut.isPending || unverifyMut.isPending || banMut.isPending || unbanMut.isPending || deleteOperatorMut.isPending

  return (
    <AppModal open onClose={onClose}>
      {isLoading && canFetchDetail ? (
        <UserSkeleton />
      ) : !canFetchDetail ? (
        // Admin/superadmin — no detail endpoint
        <div className="flex flex-col">
          <div className="bg-linear-to-r from-[#7C3AED] to-[#4C1D95] px-6 py-5 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <UserIcon />
              </div>
              <div>
                <p className="font-bold text-lg text-white">{roleLabel(role)}</p>
                <p className="text-sm text-white/60 mt-0.5">ID #{userId}</p>
              </div>
            </div>
          </div>
          <div className="px-6 py-8 text-center text-slate-400 text-sm">
            Детальная информация об администраторах недоступна.
          </div>
        </div>
      ) : !user ? null : (
        <div className="flex flex-col max-h-[85vh]">
          <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
            <div className="flex items-start gap-4 pr-2">
              <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <UserIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-white leading-tight truncate">
                  {user.full_name ?? user.login ?? user.phone ?? `#${user.id}`}
                </p>
                <p className="text-sm text-white/60 mt-0.5">{user.phone ?? user.login ?? '—'}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                    {roleLabel(user.role)}
                  </span>
                  {user.user_type && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                      {userTypeLabel(user.user_type)}
                    </span>
                  )}
                  {!user.is_active && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/80 text-white">
                      Заблокирован
                    </span>
                  )}
                  {user.is_verified && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-400/80 text-white">
                      Верифицирован
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {user.phone && <DRow label="Телефон" value={user.phone} />}
              {user.login && <DRow label="Логин" value={user.login} />}
              {user.email && <DRow label="Email" value={user.email} />}
              {user.organization_name && <DRow label="Организация" value={user.organization_name} />}
              <DRow label="Телефон подтверждён" value={user.is_phone_verified ? '✓ Да' : '✗ Нет'} />
              <DRow label="Зарегистрирован" value={fmtDate(user.created_at)} />
            </div>

            {user.cabinets.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Шкафы управления ({user.cabinets.length})</p>
                <div className="space-y-1.5">
                  {user.cabinets.map(c => (
                    <div key={c.cabinet_id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">
                        {c.custom_name ?? `ШУ ${c.object_number}`}
                      </span>
                      {c.type && <span className="text-xs text-slate-400">{c.type}</span>}
                      {c.is_primary && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Основной
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
            {deleteStep ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Удалить оператора <strong>{user.full_name ?? user.login}</strong>? Все сессии будут отозваны. Переписка сохранится.
                </p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeleteStep(false)} disabled={deleteOperatorMut.isPending} className="cursor-pointer">Отмена</Button>
                  <Button onClick={() => deleteOperatorMut.mutate()} disabled={deleteOperatorMut.isPending} className="bg-red-600 hover:bg-red-700 cursor-pointer">
                    {deleteOperatorMut.isPending ? 'Удаление...' : 'Удалить'}
                  </Button>
                </div>
              </div>
            ) : banStep ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 block">
                  Причина блокировки <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Укажите причину блокировки"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:border-[#4A8FE7]"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => { setBanStep(false); setBanReason('') }} disabled={banMut.isPending} className="cursor-pointer">Отмена</Button>
                  <Button onClick={() => banMut.mutate()} disabled={!banReason.trim() || banMut.isPending} className="bg-red-500 hover:bg-red-600 cursor-pointer">
                    {banMut.isPending ? 'Блокировка...' : 'Подтвердить'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 flex-wrap">
                {user.role === 'operator' && (
                  <Button
                    variant="outline"
                    onClick={() => setDeleteStep(true)}
                    disabled={isMutating}
                    className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 cursor-pointer mr-auto"
                  >
                    Удалить оператора
                  </Button>
                )}
                {user.is_verified ? (
                  <Button variant="outline" onClick={() => unverifyMut.mutate()} disabled={isMutating}
                    className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 cursor-pointer">
                    Снять верификацию
                  </Button>
                ) : (
                  <Button onClick={() => verifyMut.mutate()} disabled={isMutating} className="bg-green-600 hover:bg-green-700 cursor-pointer">
                    Верифицировать
                  </Button>
                )}
                {user.is_active ? (
                  <Button onClick={() => setBanStep(true)} disabled={isMutating} className="bg-red-500 hover:bg-red-600 cursor-pointer">
                    Заблокировать
                  </Button>
                ) : (
                  <Button onClick={() => unbanMut.mutate()} disabled={isMutating} className="bg-green-600 hover:bg-green-700 cursor-pointer">
                    Разблокировать
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppModal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-6 py-3">
      <span className="text-xs text-slate-400 w-32 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}

function UserSkeleton() {
  return (
    <div>
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl bg-white/20" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40 bg-white/20" />
            <Skeleton className="h-3 w-24 bg-white/20" />
          </div>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Create modals ────────────────────────────────────────────────────────

function CreateOperatorModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const createMut = useMutation({
    mutationFn: () => usersApi.createOperator({ login: login.trim(), password, full_name: fullName.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Оператор создан')
      onClose()
    },
    onError: () => toast.error('Не удалось создать оператора'),
  })

  const loginValid = login.trim().length >= 3 && !/\s/.test(login)
  const passwordValid = password.length >= 8
  const canSave = loginValid && passwordValid && !createMut.isPending

  return (
    <AppModal open onClose={onClose}>
      <div className="flex flex-col">
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0"><UserIcon /></div>
            <div>
              <p className="font-bold text-lg text-white">Новый оператор</p>
              <p className="text-sm text-white/60 mt-0.5">Создание аккаунта оператора</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <StaffField label="Логин" hint="мин. 3 символа, без пробелов" value={login} onChange={setLogin}
            error={login && !loginValid ? 'Мин. 3 символа, без пробелов' : ''} placeholder="operator1" />
          <PasswordField label="Пароль" hint="мин. 8 символов" value={password} onChange={setPassword}
            show={showPassword} onToggle={() => setShowPassword(v => !v)}
            error={password && !passwordValid ? 'Минимум 8 символов' : ''} />
          <StaffField label="ФИО" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button onClick={() => createMut.mutate()} disabled={!canSave} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
            {createMut.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

function CreateStaffModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const createMut = useMutation({
    mutationFn: () => usersApi.createAdmin({ login: login.trim(), password, full_name: fullName.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Администратор создан')
      onClose()
    },
    onError: () => toast.error('Не удалось создать администратора'),
  })

  const loginValid = login.trim().length >= 3 && !/\s/.test(login)
  const passwordValid = password.length >= 8
  const canSave = loginValid && passwordValid && !createMut.isPending

  return (
    <AppModal open onClose={onClose}>
      <div className="flex flex-col">
        <div className="bg-linear-to-r from-[#7C3AED] to-[#4C1D95] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0"><UserIcon /></div>
            <div>
              <p className="font-bold text-lg text-white">Новый администратор</p>
              <p className="text-sm text-white/60 mt-0.5">Создание аккаунта администратора</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <StaffField label="Логин" hint="мин. 3 символа, без пробелов" value={login} onChange={setLogin}
            error={login && !loginValid ? 'Мин. 3 символа, без пробелов' : ''} placeholder="admin2" />
          <PasswordField label="Пароль" hint="мин. 8 символов" value={password} onChange={setPassword}
            show={showPassword} onToggle={() => setShowPassword(v => !v)}
            error={password && !passwordValid ? 'Минимум 8 символов' : ''} />
          <StaffField label="ФИО" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button onClick={() => createMut.mutate()} disabled={!canSave} className="bg-purple-600 hover:bg-purple-700 cursor-pointer">
            {createMut.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

function StaffField({ label, hint, value, onChange, placeholder, error }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1.5">
        {label}{hint && <span className="text-slate-400 font-normal ml-1">({hint})</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off"
        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]" />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function PasswordField({ label, hint, value, onChange, show, onToggle, error }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; error?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1.5">
        {label}{hint && <span className="text-slate-400 font-normal ml-1">({hint})</span>}
      </label>
      <div className="relative">
        <input value={value} onChange={e => onChange(e.target.value)} type={show ? 'text' : 'password'}
          placeholder="••••••••" autoComplete="new-password"
          className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]" />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────

function ListIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
}
function GridIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
}
function UserIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
}
function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
function EyeIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function EyeOffIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
}
