'use client'

'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usersApi } from '@/lib/api/users'
import type { AdminUser } from '@/lib/api/users'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { RequestCard, StatusPill, TypePill } from '@/components/requests/request-card'

const STATUS_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'banned', label: 'Заблокированные' },
]

const ROLE_FILTERS = [
  { value: 'all', label: 'Все роли' },
  { value: 'user', label: 'Пользователи' },
  { value: 'operator', label: 'Операторы' },
]

const SORT_OPTIONS = [
  { value: 'created_at', label: 'По дате' },
  { value: 'full_name', label: 'По имени' },
  { value: 'role', label: 'По роли' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

function roleLabel(r: string) {
  return r === 'admin' ? 'Администратор' : r === 'operator' ? 'Оператор' : 'Пользователь'
}
function roleCls(r: string) {
  return r === 'admin'
    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    : r === 'operator'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
}
function activeCls(a: boolean) {
  return a
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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

export function UsersView() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [createOperatorOpen, setCreateOperatorOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [statusFilter, roleFilter, sortBy, sortOrder, search])

  const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', statusFilter, roleFilter, sortBy, sortOrder, search, page],
    queryFn: () => usersApi.getList({
      is_active: isActive,
      role: roleFilter === 'all' ? undefined : roleFilter,
      search: search || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      size: 20,
    }),
  })

  const handleSortClick = (val: SortValue) => {
    if (sortBy === val) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(val); setSortOrder('desc') }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            {data?.total != null && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{data.total} пользователей</p>
            )}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Пользователи</h1>
          </div>
          <Button
            onClick={() => setCreateOperatorOpen(true)}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Создать оператора
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по имени, телефону, логину"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7]"
          />
        </div>

        {/* Status + Role filters */}
        <div className="flex flex-wrap gap-2 mb-2">
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
          <div className="w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          {ROLE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setRoleFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                roleFilter === f.value
                  ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2 flex-wrap">
          {SORT_OPTIONS.map(opt => {
            const active = sortBy === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleSortClick(opt.value)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  active
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                )}
              >
                {opt.label}
                {active && <span className="text-[10px] opacity-60">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50 dark:bg-slate-900">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white dark:bg-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <p className="text-slate-400">Не удалось загрузить пользователей</p>
            <button onClick={() => refetch()} className="text-sm text-[#1B3A72] hover:underline cursor-pointer">
              Повторить
            </button>
          </div>
        )}
        {!isLoading && !isError && data?.items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <p className="text-2xl mb-2">👥</p>
            <p>Пользователей не найдено</p>
          </div>
        )}
        {!isLoading && !isError && !!data?.items.length && (
          <div className="space-y-2">
            {data.items.map(user => (
              <RequestCard
                key={user.id}
                icon={<UserIcon />}
                title={userName(user)}
                subtitle={userSubtitle(user)}
                meta={<TypePill label={roleLabel(user.role)} cls={roleCls(user.role)} />}
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
      </div>

      {data && data.pages > 1 && (
        <Pagination page={page} pages={data.pages} onPage={setPage} />
      )}

      {selectedUser && (
        <UserDialog userId={selectedUser.id} onClose={() => setSelectedUser(null)} />
      )}
      {createOperatorOpen && (
        <CreateOperatorModal onClose={() => setCreateOperatorOpen(false)} />
      )}
    </div>
  )
}

function UserDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [banStep, setBanStep] = useState(false)
  const [banReason, setBanReason] = useState('')

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => usersApi.getOne(userId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-users'] })
    qc.invalidateQueries({ queryKey: ['admin-user', userId] })
    qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const verifyMut = useMutation({
    mutationFn: () => usersApi.verify(userId),
    onSuccess: () => { invalidate(); toast.success('Пользователь верифицирован') },
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

  const isMutating = verifyMut.isPending || unverifyMut.isPending || banMut.isPending || unbanMut.isPending

  return (
    <AppModal open onClose={onClose}>
      {isLoading || !user ? (
        <UserSkeleton />
      ) : (
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
              <DRow label="Телефон" value={user.phone ?? '—'} />
              <DRow label="Логин" value={user.login ?? '—'} />
              <DRow label="Email" value={user.email ?? '—'} />
              {user.organization_name && <DRow label="Организация" value={user.organization_name} />}
              {user.user_type && <DRow label="Тип" value={user.user_type} />}
              <DRow label="Телефон подтверждён" value={user.is_phone_verified ? 'Да' : 'Нет'} />
              <DRow label="Зарегистрирован" value={fmtDate(user.created_at)} />
            </div>

            {user.cabinets.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 mb-2">
                  Шкафы управления ({user.cabinets.length})
                </p>
                <div className="space-y-1.5">
                  {user.cabinets.map(c => (
                    <div
                      key={c.cabinet_id}
                      className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">
                        ШУ {c.object_number}
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
            {banStep ? (
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
                  <Button
                    variant="ghost"
                    onClick={() => { setBanStep(false); setBanReason('') }}
                    disabled={banMut.isPending}
                    className="cursor-pointer"
                  >
                    Отмена
                  </Button>
                  <Button
                    onClick={() => banMut.mutate()}
                    disabled={!banReason.trim() || banMut.isPending}
                    className="bg-red-500 hover:bg-red-600 cursor-pointer"
                  >
                    {banMut.isPending ? 'Блокировка...' : 'Подтвердить'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                {user.is_verified ? (
                  <Button
                    variant="outline"
                    onClick={() => unverifyMut.mutate()}
                    disabled={isMutating}
                    className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20 cursor-pointer"
                  >
                    Снять верификацию
                  </Button>
                ) : (
                  <Button
                    onClick={() => verifyMut.mutate()}
                    disabled={isMutating}
                    className="bg-green-600 hover:bg-green-700 cursor-pointer"
                  >
                    Верифицировать
                  </Button>
                )}
                {user.is_active ? (
                  <Button
                    onClick={() => setBanStep(true)}
                    disabled={isMutating}
                    className="bg-red-500 hover:bg-red-600 cursor-pointer"
                  >
                    Заблокировать
                  </Button>
                ) : (
                  <Button
                    onClick={() => unbanMut.mutate()}
                    disabled={isMutating}
                    className="bg-green-600 hover:bg-green-700 cursor-pointer"
                  >
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

function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-6 py-3">
      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
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

function UserIcon() {
  return (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function CreateOperatorModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const createMut = useMutation({
    mutationFn: () => usersApi.createOperator({
      login: login.trim(),
      password,
      full_name: fullName.trim() || null,
    }),
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
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
              <UserIcon />
            </div>
            <div>
              <p className="font-bold text-lg text-white">Новый оператор</p>
              <p className="text-sm text-white/60 mt-0.5">Создание аккаунта оператора</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Логин <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(мин. 3 символа, без пробелов)</span>
            </label>
            <input
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="operator1"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
            />
            {login && !loginValid && (
              <p className="text-xs text-red-500 mt-1">Мин. 3 символа, без пробелов</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Пароль <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(мин. 8 символов)</span>
            </label>
            <div className="relative">
              <input
                value={password}
                onChange={e => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {password && !passwordValid && (
              <p className="text-xs text-red-500 mt-1">Минимум 8 символов</p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">ФИО</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button
            onClick={() => createMut.mutate()}
            disabled={!canSave}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
          >
            {createMut.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

function EyeIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function EyeOffIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
}
