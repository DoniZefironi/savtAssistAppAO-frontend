'use client'

import { useState, useEffect, useRef } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Smartphone, PhoneOff, Users } from 'lucide-react'
import { cn, isSuperadminRole } from '@/lib/utils'
import { usersApi } from '@/lib/api/users'
import type { AdminUser } from '@/lib/api/users'
import { useAuthStore } from '@/lib/store/auth'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useInfiniteScrollSentinel } from '@/lib/hooks/use-infinite-scroll-sentinel'
import { PlusIcon } from '@/components/ui/icons'
import { ViewModeToggle } from '@/components/ui/view-mode-toggle'
import { SearchInput } from '@/components/ui/search-input'
import { PillButton } from '@/components/ui/pill-button'
import { FormField, PasswordField } from '@/components/ui/form-field'
import { DialogHeader } from '@/components/ui/dialog-header'
import { RequestCard, StatusPill, TypePill } from '@/components/requests/request-card'
import { UserDialog } from './user-dialog'
import { roleLabel, fmtDate, UserIcon } from './user-shared'

// Сетка карточек: 1 колонка на самых узких, до 4 на широких мониторах
const GRID_CLASSES = 'grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3'

const STATUS_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'banned', label: 'Заблокированные' },
]

const SORT_OPTIONS = [
  { value: 'created_at', label: 'По дате' },
  { value: 'full_name', label: 'По имени' },
  { value: 'login', label: 'По логину' },
  { value: 'organization_name', label: 'По организации' },
] as const

const USER_TYPE_FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'individual', label: 'Физ. лица' },
  { value: 'organization', label: 'Организации' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']
type RoleTab = 'user' | 'operator' | 'admin'

function roleCls(r: string) {
  if (isSuperadminRole(r)) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  if (r === 'admin') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  if (r === 'operator') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
}
function activeCls(a: boolean) {
  return a
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}
function userName(u: AdminUser) {
  return u.full_name ?? u.login ?? u.phone ?? `#${u.id}`
}
// В подзаголовке основной — phone (логин, подтверждён). Рабочий contact_phone
// показываем рядом, но он не подтверждён — опознавать по нему звонящего нельзя.
function userSubtitle(u: AdminUser) {
  const primary = u.full_name ? (u.phone ?? u.login) : u.login ? u.phone : null
  if (!primary) return '—'
  return u.contact_phone ? `${primary} · раб. ${u.contact_phone}` : primary
}

function getListFn(role: RoleTab) {
  if (role === 'operator') return usersApi.getOperatorList
  if (role === 'admin') return usersApi.getAdminList
  return usersApi.getUserList
}

export function UsersView() {
  const currentUser = useAuthStore(s => s.user)
  const isSuperadmin = isSuperadminRole(currentUser?.role)
  const isReadOnly = currentUser?.role === 'operator'

  // Вкладка роли переживает перезагрузку — иначе после F5 всегда возвращало
  // на «Пользователей», даже если работали с операторами или админами.
  const [storedRoleTab, setRoleTab] = usePersistentState<RoleTab>('users-role-tab', 'user')
  // Сохранённая вкладка может быть недоступна текущей роли (например, вкладку
  // «Администраторы» сохранил суперадмин, а зашёл обычный админ, или оператор
  // открыл панель) — в этом случае откатываемся на «Пользователей», иначе
  // запрос ушёл бы к недоступному списку, а ни одна вкладка не подсвечивалась.
  const roleTab: RoleTab =
    storedRoleTab === 'operator' && isReadOnly ? 'user'
      : storedRoleTab === 'admin' && !isSuperadmin ? 'user'
        : storedRoleTab
  const [statusFilter, setStatusFilter] = useState('all')
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'individual' | 'organization'>('all')
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | null>(null)
  const [phoneVerifiedFilter, setPhoneVerifiedFilter] = useState<boolean | null>(null)
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounce(searchInput, 300)
  const [view, setView] = usePersistentState<'list' | 'grid'>('view-mode-users', 'list')
  const [filtersOpen, setFiltersOpen] = usePersistentState('filters-open-users', true)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [createOperatorOpen, setCreateOperatorOpen] = useState(false)
  const [createAdminOpen, setCreateAdminOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setStatusFilter('all')
    setUserTypeFilter('all')
    setVerifiedFilter(null)
    setPhoneVerifiedFilter(null)
    setSearchInput('')
    setSortBy('created_at')
    setSortOrder('desc')
  }, [roleTab])

  const isActive = statusFilter === 'all' ? undefined : statusFilter === 'active'

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, isFetchNextPageError, refetch } = useInfiniteQuery({
    queryKey: ['admin-users', roleTab, statusFilter, userTypeFilter, verifiedFilter, phoneVerifiedFilter, sortBy, sortOrder, search],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      getListFn(roleTab)({
        is_active: isActive,
        ...(userTypeFilter !== 'all' ? { user_type: userTypeFilter } : {}),
        ...(verifiedFilter !== null ? { is_verified: verifiedFilter } : {}),
        ...(phoneVerifiedFilter !== null ? { is_phone_verified: phoneVerifiedFilter } : {}),
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: 20,
      }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
    // Без этого — возврат на экран спустя >30с (глобальный staleTime) после
    // глубокой прокрутки списка переперезапрашивает все закэшированные
    // страницы по очереди подряд. Своя инвалидация после мутаций (бан/роль
    // и т.д.) уже держит список актуальным — авторефетч на маунте не нужен.
    refetchOnMount: false,
  })

  useInfiniteScrollSentinel(sentinelRef, { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage })

  const handleSortClick = (val: SortValue) => {
    if (sortBy === val) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(val); setSortOrder('desc') }
  }

  const allItems = data?.pages.flatMap(p => p.items) ?? []
  const total = data?.pages[0]?.total

  const ROLE_TABS: { value: RoleTab; label: string }[] = [
    { value: 'user', label: 'Пользователи' },
    ...(!isReadOnly ? [{ value: 'operator' as RoleTab, label: 'Операторы' }] : []),
    ...(isSuperadmin ? [{ value: 'admin' as RoleTab, label: 'Администраторы' }] : []),
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="max-w-425 mx-auto w-full">
        <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-3 mb-4">
          <div className="min-w-0">
            {total != null && (
              <p className="text-xs text-slate-400 font-medium mb-0.5">{total} записей</p>
            )}
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Пользователи</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ViewModeToggle view={view} onViewChange={setView} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen(v => !v)} />
            {!isReadOnly && isSuperadmin && (
              <Button onClick={() => setCreateAdminOpen(true)} className="bg-purple-600 hover:bg-purple-700 cursor-pointer dark:text-white">
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Создать администратора
              </Button>
            )}
            {!isReadOnly && (
              <Button onClick={() => setCreateUserOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer dark:text-white">
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Добавить пользователя
              </Button>
            )}
            {!isReadOnly && (
              <Button onClick={() => setCreateOperatorOpen(true)} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Создать оператора
              </Button>
            )}
          </div>
        </div>
        {/* Не переносится (сломает вид подчёркнутой навигации) — на узких экранах скроллится горизонтально */}
        <div className="flex gap-0 mb-3 overflow-x-auto">
          {ROLE_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setRoleTab(t.value)}
              className={cn(
                'px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap',
                roleTab === t.value
                  ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={cn('grid transition-[grid-template-rows] duration-150 ease-out', filtersOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden min-h-0">
        <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Поиск по имени, телефону, логину..." className="mb-3" />

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {SORT_OPTIONS.map(opt => {
            const active = sortBy === opt.value
            return (
              <PillButton key={opt.value} active={active} onClick={() => handleSortClick(opt.value)} className="flex items-center gap-1">
                {opt.label}
                {active && <span className="opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </PillButton>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="text-xs text-slate-400 font-medium mr-0.5">Фильтр:</span>
          {STATUS_FILTERS.map(f => (
            <PillButton key={f.value} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </PillButton>
          ))}

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          {USER_TYPE_FILTERS.map(f => (
            <PillButton key={f.value} active={userTypeFilter === f.value} onClick={() => setUserTypeFilter(f.value)}>
              {f.label}
            </PillButton>
          ))}

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

          <button
            onClick={() => setVerifiedFilter(v => v === true ? null : true)}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
              verifiedFilter === true
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Верифицированные
          </button>
          <button
            onClick={() => setVerifiedFilter(v => v === false ? null : false)}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
              verifiedFilter === false
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-500'
            )}
          >
            <XCircle className="w-3.5 h-3.5" />
            Не верифицированные
          </button>
          <button
            onClick={() => setPhoneVerifiedFilter(v => v === true ? null : true)}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
              phoneVerifiedFilter === true
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
            )}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Номер подтверждён
          </button>
          <button
            onClick={() => setPhoneVerifiedFilter(v => v === false ? null : false)}
            className={cn(
              'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
              phoneVerifiedFilter === false
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-400 hover:text-rose-500'
            )}
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Номер не подтверждён
          </button>
        </div>
        </div>
        </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth px-3 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-425 mx-auto">
        {isLoading && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-2'}>
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
            <Users className="w-8 h-8 mb-2 opacity-50" />
            <p>Пользователей не найдено</p>
          </div>
        )}
        {allItems.length > 0 && (
          <div className={view === 'grid' ? GRID_CLASSES : 'space-y-2'}>
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
        {isFetchNextPageError && (
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <p className="text-sm text-slate-400">Не удалось подгрузить ещё</p>
            <button onClick={() => fetchNextPage()} className="text-sm text-[#1B3A72] hover:underline cursor-pointer">Повторить</button>
          </div>
        )}
        {!hasNextPage && (total ?? 0) > 0 && (
          <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
            Все {total} записей загружены
          </p>
        )}
        </div>
      </div>

      {selectedUser && (
        <UserDialog userId={selectedUser.id} role={selectedUser.role} onClose={() => setSelectedUser(null)} />
      )}
      {createUserOpen && <CreateUserModal onClose={() => setCreateUserOpen(false)} />}
      {createOperatorOpen && <CreateOperatorModal onClose={() => setCreateOperatorOpen(false)} />}
      {createAdminOpen && <CreateStaffModal onClose={() => setCreateAdminOpen(false)} />}
    </div>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [userType, setUserType] = useState<'individual' | 'organization'>('individual')
  const [organizationName, setOrganizationName] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const createMut = useMutation({
    mutationFn: () => usersApi.createUser({
      phone: phone.trim(),
      password,
      full_name: fullName.trim(),
      user_type: userType,
      organization_name: userType === 'organization' ? organizationName.trim() : null,
      contact_phone: contactPhone.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Пользователь создан')
      onClose()
    },
    // 409 — телефон уже зарегистрирован (см. README-backend.md, POST /admin/users)
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 409) toast.error('Этот телефон уже зарегистрирован')
      else toast.error('Не удалось создать пользователя')
    },
  })

  const phoneValid = /^\+\d{9,15}$/.test(phone.trim())
  const passwordValid = password.length >= 8
  const fullNameValid = fullName.trim().length > 0
  const orgValid = userType !== 'organization' || organizationName.trim().length > 0
  const canSave = phoneValid && passwordValid && fullNameValid && orgValid && !createMut.isPending

  return (
    <AppModal open onClose={onClose}>
      <div className="flex flex-col">
        <DialogHeader
          icon={<UserIcon />}
          title="Новый пользователь"
          subtitle="Создание аккаунта клиента напрямую, минуя заявку"
          gradient="from-emerald-500 to-emerald-700"
        />
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <FormField label="Телефон" hint="логин, формат +375291234567" value={phone} onChange={setPhone}
            error={phone && !phoneValid ? 'Формат: + и от 9 до 15 цифр' : ''} placeholder="+375291234567" />
          <PasswordField label="Пароль" hint="мин. 8 символов" value={password} onChange={setPassword}
            error={password && !passwordValid ? 'Минимум 8 символов' : ''} />
          <FormField label="ФИО" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Тип</label>
            <div className="flex gap-2">
              {(['individual', 'organization'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setUserType(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer',
                    userType === t
                      ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  {t === 'individual' ? 'Физ. лицо' : 'Организация'}
                </button>
              ))}
            </div>
          </div>
          {userType === 'organization' && (
            <FormField label="Организация" value={organizationName} onChange={setOrganizationName}
              error={!orgValid ? 'Обязательно для организации' : ''}
              placeholder="ООО «Ромашка»" />
          )}
          <FormField label="Контактный телефон" hint="необязательно" value={contactPhone} onChange={setContactPhone} placeholder="+375291234567" />
        </div>
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button onClick={() => createMut.mutate()} disabled={!canSave} className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer dark:text-white">
            {createMut.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

function CreateOperatorModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')

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
        <DialogHeader icon={<UserIcon />} title="Новый оператор" subtitle="Создание аккаунта оператора" />
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <FormField label="Логин" hint="мин. 3 символа, без пробелов" value={login} onChange={setLogin}
            error={login && !loginValid ? 'Мин. 3 символа, без пробелов' : ''} placeholder="operator1" />
          <PasswordField label="Пароль" hint="мин. 8 символов" value={password} onChange={setPassword}
            error={password && !passwordValid ? 'Минимум 8 символов' : ''} />
          <FormField label="ФИО" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        </div>
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button onClick={() => createMut.mutate()} disabled={!canSave} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
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
        <DialogHeader
          icon={<UserIcon />}
          title="Новый администратор"
          subtitle="Создание аккаунта администратора"
          gradient="from-[#7C3AED] to-[#4C1D95]"
        />
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <FormField label="Логин" hint="мин. 3 символа, без пробелов" value={login} onChange={setLogin}
            error={login && !loginValid ? 'Мин. 3 символа, без пробелов' : ''} placeholder="admin2" />
          <PasswordField label="Пароль" hint="мин. 8 символов" value={password} onChange={setPassword}
            error={password && !passwordValid ? 'Минимум 8 символов' : ''} />
          <FormField label="ФИО" value={fullName} onChange={setFullName} placeholder="Иванов Иван Иванович" />
        </div>
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button onClick={() => createMut.mutate()} disabled={!canSave} className="bg-purple-600 hover:bg-purple-700 cursor-pointer dark:text-white">
            {createMut.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}
