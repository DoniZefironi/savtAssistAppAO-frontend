'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { projectsApi, type ProjectCabinetFilters } from '@/lib/api/projects'
import { formatDate } from '@/lib/warranty'
import { cn } from '@/lib/utils'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { ProjectQrDialog } from './project-qr-dialog'
import type { Project } from '@/types'

interface Props {
  projectId: number | null
  isAdmin: boolean
  filters?: ProjectCabinetFilters
  onClose: () => void
}

export function ProjectDetailDialog({ projectId, isAdmin, filters, onClose }: Props) {
  return (
    <AppModal open={projectId !== null} onClose={onClose}>
      {projectId !== null && <DetailContent projectId={projectId} isAdmin={isAdmin} filters={filters} />}
    </AppModal>
  )
}

function DetailContent({ projectId, isAdmin, filters }: { projectId: number; isAdmin: boolean; filters?: ProjectCabinetFilters }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [showQr, setShowQr] = useState(false)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)

  // Фильтры из списка "Проекты ШУ" пробрасываются сюда — если задан has_documents/
  // has_photos/... и т.п., карточка проекта показывает только подходящие шкафы
  // (бэкенд ожидаемо фильтрует cabinets в ответе, см. lib/api/projects.ts)
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId, filters],
    queryFn: () => projectsApi.getOne(projectId, filters),
  })

  useEffect(() => {
    if (project) setName(project.name)
  }, [project])

  const updateMutation = useMutation({
    mutationFn: () => projectsApi.update(projectId, name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Проект переименован')
      setEditing(false)
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const handleSave = () => {
    if (!name.trim()) { setError('Обязательное поле'); return }
    setError(undefined)
    updateMutation.mutate()
  }

  const handleCancel = () => {
    if (project) setName(project.name)
    setError(undefined)
    setEditing(false)
  }

  if (isLoading || !project) return <DetailSkeleton />

  const qrProject: Project = {
    id: project.id,
    name: project.name,
    unique_code: project.unique_code,
    cabinet_count: project.cabinets.length,
    created_at: project.created_at,
  }

  return (
    <div className="flex flex-col max-h-[85vh] min-w-0">
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5 shrink-0">
        <div className="flex items-start gap-3 sm:gap-4 pr-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <FolderIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(undefined) }}
                  className={cn(
                    'w-full font-bold text-lg text-white bg-transparent border-b outline-none placeholder:text-white/30 pb-0.5 leading-tight',
                    error ? 'border-red-300' : 'border-white/30 focus:border-white'
                  )}
                />
                {error && <p className="text-xs text-red-200 mt-0.5">{error}</p>}
              </>
            ) : (
              <p className="font-bold text-lg text-white leading-tight truncate">{project.name}</p>
            )}
            <p className="text-sm text-white/60 mt-0.5">{project.cabinets.length} шкафов · создан {formatDate(project.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 sm:px-6 py-3 flex justify-end">
          <Button variant="outline" onClick={() => setShowQr(true)} className="gap-2 cursor-pointer">
            <QrIcon className="w-4 h-4" />
            Показать QR
          </Button>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
          {project.cabinets.length === 0 && (
            <p className="px-4 sm:px-6 py-6 text-sm text-slate-300 italic text-center">В проекте пока нет шкафов</p>
          )}
          {project.cabinets.map((c) => (
            <button
              key={c.id}
              onClick={() => setSubCabinetId(c.id)}
              className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left cursor-pointer group"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-[#1B3A72] dark:group-hover:text-blue-400">
                  {c.admin_internal_name ?? c.object_number}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{c.object_number}{c.type ? ` · ${c.type}` : ''}</p>
              </div>
              <svg className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              title="Переименовать"
              className="w-8 h-8 rounded-lg bg-blue/15 hover:bg-blue/25 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <PencilIcon className="w-4 h-4 text-blue" />
            </button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </>
          )}
        </div>
      )}

      {showQr && <ProjectQrDialog project={qrProject} onClose={() => setShowQr(false)} />}
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin={isAdmin} onClose={() => setSubCabinetId(null)} />}
    </div>
  )
}

function DetailSkeleton() {
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
      <div className="px-6 py-4 space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 015.25 3.75h5.379a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18.75A2.25 2.25 0 0121 9v.776" />
    </svg>
  )
}
function QrIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  )
}
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}
