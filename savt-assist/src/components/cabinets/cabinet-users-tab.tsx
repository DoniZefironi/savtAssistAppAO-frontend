'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { Skeleton } from '@/components/ui/skeleton'
import { cabinetsApi } from '@/lib/api/cabinets'
import { projectsApi } from '@/lib/api/projects'
import { apiErrorMessage } from '@/lib/api/errors'
import type { ProjectUser } from '@/lib/api/projects'
import { UserDialog } from '@/components/users/user-dialog'
import { RevokeAccessDialog } from '@/components/users/revoke-access-dialog'
import { UsersIcon, TrashIcon } from './cabinet-dialog-icons'

// Здесь две категории: участники проекта (доступ ко всем шкафам проекта разом) и
// те, кто добавил именно этот ШУ напрямую по его QR (GET /admin/cabinets/{id}/users
// отдаёт обе, признака «откуда доступ» в ответе нет). Поэтому «участник проекта»
// определяем сверкой со списком участников проекта: ему доступно «Убрать из
// проекта» (снимает со ВСЕХ шкафов проекта), остальным — «Отвязать ШУ» (только
// этот шкаф). Пока список участников проекта не загрузился, кнопок нет — иначе
// участник проекта на секунду выглядел бы как добавивший напрямую.
export function UsersTab({ cabinetId, projectId, projectName, isAdmin }: { cabinetId: number; projectId: number | null; projectName: string | null; isAdmin: boolean }) {
  const qc = useQueryClient()
  const [viewUserId, setViewUserId] = useState<number | null>(null)
  const [revoke, setRevoke] = useState<{ user: ProjectUser; kind: 'project' | 'cabinet' } | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-users', cabinetId],
    queryFn: () => cabinetsApi.getUsers(cabinetId),
  })

  const { data: projectUsers } = useQuery({
    queryKey: ['project-users', projectId],
    queryFn: () => projectsApi.getUsers(projectId!),
    enabled: projectId != null && isAdmin,
  })
  const membersKnown = projectId == null || projectUsers !== undefined
  const projectMemberIds = new Set((projectUsers ?? []).map(u => u.user_id))

  const closeRevoke = () => { setRevoke(null); setRevokeError(null) }

  const revokeMut = useMutation({
    mutationFn: ({ user, kind, reason }: { user: ProjectUser; kind: 'project' | 'cabinet'; reason: string }) =>
      kind === 'project'
        ? projectsApi.removeUser(projectId!, user.user_id, reason)
        : cabinetsApi.unlinkUser(cabinetId, user.user_id, reason),
    onSuccess: (_, { kind }) => {
      qc.invalidateQueries({ queryKey: ['project-users'] })
      qc.invalidateQueries({ queryKey: ['cabinet-users'] })
      qc.invalidateQueries({ queryKey: ['admin-user'] })
      toast.success(kind === 'project' ? 'Пользователь убран из проекта' : 'ШУ отвязан')
      closeRevoke()
    },
    onError: (e, { kind }) => {
      const status = isAxiosError(e) ? e.response?.status : undefined
      const text = apiErrorMessage(e, kind === 'project' ? 'Не удалось убрать из проекта' : 'Не удалось отвязать ШУ')
      if (status === 404) {
        // Уже убрали — список устарел, перечитываем.
        qc.invalidateQueries({ queryKey: ['project-users'] })
        qc.invalidateQueries({ queryKey: ['cabinet-users'] })
        toast.error(text)
        closeRevoke()
      } else if (status === 409) {
        // Доступ идёт через проект — показываем текст сервера в окне.
        qc.invalidateQueries({ queryKey: ['project-users'] })
        setRevokeError(text)
      } else {
        toast.error(text)
      }
    },
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

  const who = (u: ProjectUser) => u.full_name ?? u.phone ?? `#${u.user_id}`

  return (
    <>
      <p className="text-xs text-slate-400 px-6 pt-3">
        {projectId != null
          ? <>Участники проекта «{projectName}» (доступ ко всем его шкафам разом) и те, кто добавил именно этот ШУ по его QR.</>
          : <>ШУ не привязан к проекту — здесь только те, кто добавил именно этот шкаф по его QR.</>}
      </p>
      <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
        {users.map(u => {
          const isMember = projectMemberIds.has(u.user_id)
          return (
            <UserRow
              key={u.user_id}
              user={u}
              removeKind={isAdmin && membersKnown ? (isMember ? 'project' : 'cabinet') : null}
              onView={() => setViewUserId(u.user_id)}
              onRemove={(kind) => { setRevokeError(null); setRevoke({ user: u, kind }) }}
            />
          )
        })}
      </div>
      {viewUserId !== null && (
        <UserDialog userId={viewUserId} role="user" onClose={() => setViewUserId(null)} />
      )}
      {revoke && (
        <RevokeAccessDialog
          key={`${revoke.kind}-${revoke.user.user_id}`}
          title={revoke.kind === 'project' ? 'Убрать из проекта?' : 'Отвязать ШУ?'}
          warning={revoke.kind === 'project' ? (
            <>
              <strong>{who(revoke.user)}</strong> потеряет доступ ко <strong>всем шкафам</strong> проекта «{projectName}», а не только к этому.
              Его чаты по проекту и его шкафам будут архивированы (чаты других участников не затрагиваются),
              ему придёт уведомление «Доступ к проекту отозван».
            </>
          ) : (
            <>
              <strong>{who(revoke.user)}</strong> потеряет доступ к этому ШУ. Его чаты по этому шкафу будут архивированы,
              ему придёт уведомление «Доступ к ШУ отозван».
            </>
          )}
          confirmLabel={revoke.kind === 'project' ? 'Убрать из проекта' : 'Отвязать'}
          pending={revokeMut.isPending}
          error={revokeError}
          extra={revokeError && revoke.kind === 'cabinet' && projectId != null ? (
            <button
              type="button"
              onClick={() => { setRevokeError(null); setRevoke({ user: revoke.user, kind: 'project' }) }}
              className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer text-left"
            >
              Убрать из проекта «{projectName}» целиком…
            </button>
          ) : undefined}
          onConfirm={(reason) => revokeMut.mutate({ user: revoke.user, kind: revoke.kind, reason })}
          onClose={closeRevoke}
        />
      )}
    </>
  )
}

function UserRow({ user, removeKind, onView, onRemove }: {
  user: ProjectUser
  removeKind: 'project' | 'cabinet' | null
  onView: () => void
  onRemove: (kind: 'project' | 'cabinet') => void
}) {
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
        {removeKind && (
          <button
            onClick={() => onRemove(removeKind)}
            title={removeKind === 'project' ? 'Убрать из проекта' : 'Отвязать ШУ'}
            className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
