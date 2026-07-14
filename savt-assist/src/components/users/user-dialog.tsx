'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, XCircle } from 'lucide-react'
import { usersApi } from '@/lib/api/users'
import { useAuthStore } from '@/lib/store/auth'
import { isSuperadminRole } from '@/lib/utils'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { roleLabel, userTypeLabel, fmtDate, DRow, UserIcon } from './user-shared'

export function UserDialog({ userId, role, onClose }: { userId: number; role: string; onClose: () => void }) {
  const qc = useQueryClient()
  const currentUser = useAuthStore(s => s.user)
  const isReadOnly = currentUser?.role === 'operator'
  const [banStep, setBanStep] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [deleteStep, setDeleteStep] = useState(false)
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | null>(null)

  // Админ/суперадмин в списке — это staff-карточка: только просмотр, без действий
  // (на управление админами серверных эндпоинтов нет, есть лишь GET /admin/admins/{id}).
  const isStaffAdmin = role === 'admin' || isSuperadminRole(role)
  const canFetchDetail = role === 'user' || role === 'operator' || isStaffAdmin

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => isStaffAdmin ? usersApi.getAdminOne(userId) : usersApi.getOne(userId),
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
        <div className="flex flex-col">
          <div className="bg-linear-to-r from-[#7C3AED] to-[#4C1D95] px-4 sm:px-6 py-4 sm:py-5 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                <UserIcon />
              </div>
              <div>
                <p className="font-bold text-lg text-white">{roleLabel(role)}</p>
                <p className="text-sm text-white/60 mt-0.5">ID #{userId}</p>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
            Детальная информация об администраторах недоступна.
          </div>
        </div>
      ) : !user ? null : (
        // min-w-0 на диве ниже — без него grid-item (Popup — display:grid) не
        // сжимается ниже ширины контента и вылезает шире модалки, см. cabinet-detail-dialog.tsx
        <div className="flex flex-col max-h-[85vh] min-w-0">
          <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5 shrink-0">
            {/* pr-8 (не pr-2) — иначе на узких экранах длинное имя пользователя
                налезает на крестик закрытия (absolute right-3, w-7 ≈ 40px) */}
            <div className="flex items-start gap-3 sm:gap-4 pr-8">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
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
              <DRow label="Телефон подтверждён" value={
                user.is_phone_verified
                  ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" />Да</span>
                  : <span className="flex items-center gap-1 text-rose-500 dark:text-rose-400"><XCircle className="w-4 h-4" />Нет</span>
              } />
              <DRow label="Зарегистрирован" value={fmtDate(user.created_at)} />
            </div>

            {(user.cabinets?.length ?? 0) > 0 && (
              <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Шкафы управления ({user.cabinets.length})</p>
                <div className="space-y-1.5">
                  {user.cabinets.map(c => (
                    <button
                      key={c.cabinet_id}
                      onClick={() => setSelectedCabinetId(c.cabinet_id)}
                      className="w-full flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/70 rounded-lg px-3 py-2 transition-colors cursor-pointer text-left group"
                    >
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1 group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 transition-colors">
                        {c.custom_name ?? `ШУ ${c.object_number}`}
                      </span>
                      {c.type && <span className="text-xs text-slate-400">{c.type}</span>}
                      {c.is_primary && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Основной
                        </span>
                      )}
                      <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isReadOnly && !isStaffAdmin && <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 shrink-0">
            {deleteStep ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-300 wrap-break-word">
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
          </div>}
        </div>
      )}
      {selectedCabinetId !== null && (
        <CabinetDetailDialog
          cabinetId={selectedCabinetId}
          isAdmin
          onClose={() => setSelectedCabinetId(null)}
        />
      )}
    </AppModal>
  )
}

function UserSkeleton() {
  return (
    <div>
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40 bg-white/20" />
            <Skeleton className="h-3 w-24 bg-white/20" />
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-4 space-y-4">
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
