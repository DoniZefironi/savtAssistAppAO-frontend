'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Users, UserMinus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { projectsApi } from '@/lib/api/projects'
import type { ProjectUser } from '@/lib/api/projects'
import { apiErrorMessage } from '@/lib/api/errors'
import { userTypeLabel } from '@/components/users/user-shared'
import { UserDialog } from '@/components/users/user-dialog'
import { RevokeAccessDialog } from '@/components/users/revoke-access-dialog'

// Все пользователи, привязанные к проекту (GET /admin/projects/{id}/users).
// Доступ у них ко всем шкафам проекта разом; убрать можно только из проекта
// целиком — это и делает кнопка в строке (админу).
export function ProjectUsersTab({ projectId, projectName, isAdmin }: { projectId: number; projectName: string; isAdmin: boolean }) {
  const qc = useQueryClient()
  const [viewUserId, setViewUserId] = useState<number | null>(null)
  const [revokeUser, setRevokeUser] = useState<ProjectUser | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: () => projectsApi.getUsers(projectId),
  })

  const closeRevoke = () => { setRevokeUser(null); setRevokeError(null) }

  const revokeMut = useMutation({
    mutationFn: ({ user, reason }: { user: ProjectUser; reason: string }) =>
      projectsApi.removeUser(projectId, user.user_id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-users'] })
      qc.invalidateQueries({ queryKey: ['cabinet-users'] })
      qc.invalidateQueries({ queryKey: ['admin-user'] })
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Пользователь убран из проекта')
      closeRevoke()
    },
    onError: (e) => {
      const text = apiErrorMessage(e, 'Не удалось убрать из проекта')
      if (isAxiosError(e) && e.response?.status === 404) {
        // Уже убрали — список устарел.
        qc.invalidateQueries({ queryKey: ['project-users'] })
        toast.error(text)
        closeRevoke()
      } else {
        setRevokeError(text)
      }
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-slate-400 text-center py-12">Не удалось загрузить пользователей</p>
  }

  const users = data ?? []

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Users className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">К проекту пока никто не привязан</p>
      </div>
    )
  }

  return (
    <>
      <p className="text-xs text-slate-400 mb-3">
        Пользователи проекта ({users.length}) — у каждого доступ ко всем шкафам проекта разом.
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {users.map(u => (
          <div
            key={u.user_id}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all"
          >
            <button
              onClick={() => setViewUserId(u.user_id)}
              className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer group"
            >
              <span className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 group-hover:bg-[#1B3A72]/10 dark:group-hover:bg-blue-900/30 transition-colors">
                <Users className="w-4 h-4 text-slate-400" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 transition-colors">
                  {u.full_name ?? u.phone ?? `#${u.user_id}`}
                </span>
                <span className="flex items-center gap-x-3 gap-y-0.5 mt-0.5 flex-wrap text-xs text-slate-400">
                  {u.phone && <span>{u.phone}</span>}
                  {u.user_type && <span>{userTypeLabel(u.user_type)}</span>}
                  <span>с {new Date(u.added_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </span>
              </span>
            </button>
            {isAdmin && (
              <button
                onClick={() => { setRevokeError(null); setRevokeUser(u) }}
                title="Убрать из проекта"
                aria-label="Убрать из проекта"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer shrink-0"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {viewUserId !== null && (
        <UserDialog userId={viewUserId} role="user" onClose={() => setViewUserId(null)} />
      )}
      {revokeUser && (
        <RevokeAccessDialog
          key={revokeUser.user_id}
          title="Убрать из проекта?"
          warning={
            <>
              <strong>{revokeUser.full_name ?? revokeUser.phone ?? `#${revokeUser.user_id}`}</strong> потеряет доступ ко{' '}
              <strong>всем шкафам</strong> проекта «{projectName}». Его чаты по проекту и его шкафам будут архивированы
              (чаты других участников не затрагиваются), ему придёт уведомление «Доступ к проекту отозван».
            </>
          }
          confirmLabel="Убрать из проекта"
          pending={revokeMut.isPending}
          error={revokeError}
          onConfirm={(reason) => revokeMut.mutate({ user: revokeUser, reason })}
          onClose={closeRevoke}
        />
      )}
    </>
  )
}
