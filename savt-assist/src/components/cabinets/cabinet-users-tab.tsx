'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cabinetsApi } from '@/lib/api/cabinets'
import type { CabinetUser } from '@/lib/api/cabinets'
import { UserDialog } from '@/components/users/user-dialog'
import { UsersIcon, TrashIcon } from './cabinet-dialog-icons'

export function UsersTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const [viewUserId, setViewUserId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-users', cabinetId],
    queryFn: () => cabinetsApi.getCabinetUsers(cabinetId),
  })

  const removeMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) =>
      cabinetsApi.removeCabinetUser(cabinetId, userId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-users', cabinetId] })
      toast.success('Пользователь откреплён')
    },
    onError: () => toast.error('Ошибка при откреплении'),
  })

  const users = data ?? []

  if (isLoading) {
    return (
      <div className="space-y-2 px-6 py-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <UsersIcon className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Нет привязанных пользователей</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
        {users.map(u => (
          <UserRow
            key={u.user_id}
            user={u}
            isAdmin={isAdmin}
            onView={() => setViewUserId(u.user_id)}
            onRemove={(reason) => removeMut.mutate({ userId: u.user_id, reason })}
            removing={removeMut.isPending}
          />
        ))}
      </div>
      {viewUserId !== null && (
        <UserDialog userId={viewUserId} role="user" onClose={() => setViewUserId(null)} />
      )}
    </>
  )
}

function UserRow({ user, isAdmin, onView, onRemove, removing }: {
  user: CabinetUser
  isAdmin: boolean
  onView: () => void
  onRemove: (reason: string) => void
  removing: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(false)

  const handleRemoveClick = () => {
    if (!reason.trim()) { setReasonError(true); return }
    onRemove(reason)
    setShowForm(false)
    setReason('')
    setReasonError(false)
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="px-6 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onView}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 hover:bg-[#1B3A72]/10 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
        >
          <UsersIcon className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={onView} className="flex-1 min-w-0 text-left cursor-pointer group">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 transition-colors">
              {user.full_name ?? user.phone ?? `#${user.user_id}`}
            </p>
            {user.is_primary && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shrink-0">
                Основной
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {user.phone && (
              <span className="text-xs text-slate-400">{user.phone}</span>
            )}
            {user.custom_name && (
              <span className="text-xs text-slate-400 italic">«{user.custom_name}»</span>
            )}
            <span className="text-xs text-slate-400">с {fmtDate(user.added_at)}</span>
          </div>
        </button>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            title="Открепить"
            className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 space-y-2 pl-12">
          <label className="text-xs font-medium text-slate-500 block">
            Причина открепления <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setReasonError(false) }}
            placeholder="Укажите причину"
            rows={2}
            className={cn(
              'w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none',
              reasonError
                ? 'border-red-400 focus:border-red-500 dark:border-red-500'
                : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
            )}
          />
          {reasonError && <p className="text-xs text-red-500">Обязательное поле</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => { setShowForm(false); setReason(''); setReasonError(false) }}
              disabled={removing}
              className="h-7 text-xs px-2 cursor-pointer"
            >
              Отмена
            </Button>
            <Button
              onClick={handleRemoveClick}
              disabled={removing}
              className="h-7 text-xs px-3 bg-red-500 hover:bg-red-600 cursor-pointer"
            >
              {removing ? 'Откреп...' : 'Открепить'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
