'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cabinetsApi } from '@/lib/api/cabinets'
import { projectsApi } from '@/lib/api/projects'
import type { ProjectUser } from '@/lib/api/projects'
import { UserDialog } from '@/components/users/user-dialog'
import { UsersIcon, TrashIcon } from './cabinet-dialog-icons'

// Здесь две категории: участники проекта (доступ ко всем шкафам проекта разом) и
// те, кто добавил именно этот ШУ напрямую по его QR (GET /admin/cabinets/{id}/users
// отдаёт обе, признака «откуда доступ» в ответе нет). Убрать можно только
// участника проекта — DELETE /admin/projects/{id}/users/{user_id} снимает его
// разом со всех шкафов проекта; ручки, снимающей прямой доступ к одному ШУ, нет.
// Поэтому «участник проекта» определяем сверкой со списком участников проекта.
export function UsersTab({ cabinetId, projectId, projectName, isAdmin }: { cabinetId: number; projectId: number | null; projectName: string | null; isAdmin: boolean }) {
  const qc = useQueryClient()
  const [viewUserId, setViewUserId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-users', cabinetId],
    queryFn: () => cabinetsApi.getUsers(cabinetId),
  })

  const { data: projectUsers } = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: () => projectsApi.getUsers(projectId!),
    enabled: projectId != null && isAdmin,
  })
  const projectMemberIds = new Set((projectUsers ?? []).map(u => u.user_id))

  const removeMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) =>
      projectsApi.removeUser(projectId!, userId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-users', projectId] })
      qc.invalidateQueries({ queryKey: ['cabinet-users', cabinetId] })
      toast.success('Пользователь убран из проекта')
    },
    onError: () => toast.error('Ошибка при удалении'),
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
        <p className="text-sm">Нет пользователей с доступом</p>
      </div>
    )
  }

  return (
    <>
      <p className="text-xs text-slate-400 px-6 pt-3">
        {projectId != null
          ? <>Участники проекта «{projectName}» (доступ ко всем его шкафам разом) и те, кто добавил именно этот ШУ по его QR.</>
          : <>ШУ не привязан к проекту — здесь только те, кто добавил именно этот шкаф по его QR.</>}
      </p>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
        {users.map(u => (
          <UserRow
            key={u.user_id}
            user={u}
            isAdmin={isAdmin && projectMemberIds.has(u.user_id)}
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
  user: ProjectUser
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
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {user.phone && (
              <span className="text-xs text-slate-400">{user.phone}</span>
            )}
            <span className="text-xs text-slate-400">с {fmtDate(user.added_at)}</span>
          </div>
        </button>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            title="Убрать из проекта"
            className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 space-y-2 pl-12">
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Уберёт доступ разом ко всем шкафам этого проекта, не только к этому.
          </p>
          <label className="text-xs font-medium text-slate-500 block">
            Причина удаления <span className="text-red-500">*</span>
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
              {removing ? 'Удаление...' : 'Убрать'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
