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
import { RequestCard, StatusPill, TypePill } from '@/components/requests/request-card'

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'banned', label: 'Заблокированные' },
]

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
  const [filter, setFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const isActive = filter === 'all' ? undefined : filter === 'active'

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', filter, search],
    queryFn: () => usersApi.getList({ is_active: isActive, search: search || undefined, size: 50 }),
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60">
        <div className="mb-4">
          {data?.total != null && (
            <p className="text-xs text-slate-400 font-medium mb-0.5">{data.total} пользователей</p>
          )}
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Пользователи</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Поиск по имени, телефону, логину"
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7]"
            />
          </div>
          <div className="flex gap-2">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filter === f.value
                    ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
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
            <button onClick={() => refetch()} className="text-sm text-[#1B3A72] hover:underline">
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

      {selectedUser && (
        <UserDialog userId={selectedUser.id} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}

function UserDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const qc = useQueryClient()

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
    mutationFn: () => usersApi.ban(userId),
    onSuccess: () => { invalidate(); toast.success('Пользователь заблокирован') },
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

          <div className="overflow-y-auto">
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

          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
            {user.is_verified ? (
              <Button
                variant="outline"
                onClick={() => unverifyMut.mutate()}
                disabled={isMutating}
                className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20"
              >
                Снять верификацию
              </Button>
            ) : (
              <Button
                onClick={() => verifyMut.mutate()}
                disabled={isMutating}
                className="bg-green-600 hover:bg-green-700"
              >
                Верифицировать
              </Button>
            )}
            {user.is_active ? (
              <Button
                onClick={() => banMut.mutate()}
                disabled={isMutating}
                className="bg-red-500 hover:bg-red-600"
              >
                Заблокировать
              </Button>
            ) : (
              <Button
                onClick={() => unbanMut.mutate()}
                disabled={isMutating}
                className="bg-green-600 hover:bg-green-700"
              >
                Разблокировать
              </Button>
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
