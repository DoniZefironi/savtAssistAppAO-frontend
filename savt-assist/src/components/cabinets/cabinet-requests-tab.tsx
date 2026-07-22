'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { requestsApi } from '@/lib/api/requests'
import { ServiceDialog } from '@/components/requests/service-dialog'
import { formatDate } from '@/lib/warranty'
import { cn } from '@/lib/utils'
import type { ServiceRequest } from '@/types'
import { useAuthStore } from '@/lib/store/auth'
import { ToolIcon } from './cabinet-dialog-icons'

const REQUEST_TYPE_LABELS: Record<string, string> = {
  repair: 'Ремонт',
  diagnostics: 'Диагностика',
  remote_adjustment: 'Наладка удалённо',
  onsite_adjustment: 'Наладка с выездом',
  other: 'Другое',
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: 'Открыта',
  in_progress: 'В работе',
  closed: 'Закрыта',
}

const REQUEST_STATUS_NEXT: Record<string, string> = {
  open: 'in_progress',
  in_progress: 'closed',
}

export function ServiceRequestsTab({ cabinetId }: { cabinetId: number }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState('open')
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [statusConfirm, setStatusConfirm] = useState<{ id: number; next: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-service-requests', cabinetId, status],
    queryFn: () => requestsApi.getServiceRequests({ cabinet_id: cabinetId, status, size: 50 }),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      requestsApi.updateServiceRequestStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-service-requests', cabinetId] })
      toast.success('Статус обновлён')
      setStatusConfirm(null)
    },
    onError: () => toast.error('Не удалось обновить статус'),
  })

  const STATUS_TABS = [
    { value: 'open', label: 'Открытые' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'closed', label: 'Закрытые' },
  ]

  const requests = data?.items ?? []

  return (
    <>
      <div>
        <div className="flex border-b border-slate-100 dark:border-slate-700/30 shrink-0 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setStatus(t.value)}
              className={cn(
                'px-3 sm:px-4 py-2.5 text-sm transition-colors cursor-pointer border-b-2 shrink-0 whitespace-nowrap',
                status === t.value
                  ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400 font-medium'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-2 px-6 py-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && requests.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400">
            <ToolIcon className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Нет заявок</p>
          </div>
        )}

        {!isLoading && requests.length > 0 && (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
            {requests.map(req => (
              <ServiceRequestRow
                key={req.id}
                req={req}
                onSelect={() => setSelectedRequest(req)}
                onStatusChange={next => setStatusConfirm({ id: req.id, next })}
                pending={statusMut.isPending}
              />
            ))}
          </div>
        )}
      </div>
      {selectedRequest && (
        <ServiceDialog request={selectedRequest} onClose={() => setSelectedRequest(null)} />
      )}
      {statusConfirm && (
        <AppModal open onClose={() => setStatusConfirm(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Изменить статус заявки?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Статус заявки #{statusConfirm.id} изменится на «{REQUEST_STATUS_LABELS[statusConfirm.next]}».
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setStatusConfirm(null)} disabled={statusMut.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={() => statusMut.mutate({ id: statusConfirm.id, status: statusConfirm.next })}
                disabled={statusMut.isPending}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {statusMut.isPending ? 'Сохранение...' : 'Подтвердить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}
    </>
  )
}

function ServiceRequestRow({ req, onSelect, onStatusChange, pending }: {
  req: ServiceRequest
  onSelect: () => void
  onStatusChange: (next: string) => void
  pending: boolean
}) {
  const next = REQUEST_STATUS_NEXT[req.status]
  const currentUser = useAuthStore(s => s.user)
  const canChangeStatus = currentUser?.role !== 'operator'

  return (
    <div className="px-6 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
      <button onClick={onSelect} className="flex-1 min-w-0 text-left cursor-pointer">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
            {REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}
          </span>
          <span className={cn(
            'text-xs px-2 py-0.5 rounded font-medium',
            req.status === 'open' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
            req.status === 'in_progress' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            req.status === 'closed' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
          )}>
            {REQUEST_STATUS_LABELS[req.status]}
          </span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 line-clamp-2 group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 transition-colors">{req.description}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {req.user_full_name && <span className="text-xs text-slate-400">{req.user_full_name}</span>}
          <span className="text-xs text-slate-400">{formatDate(req.created_at)}</span>
        </div>
      </button>
      {next && canChangeStatus && (
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(next) }}
          disabled={pending}
          className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-[#1B3A72] hover:text-[#1B3A72] dark:hover:border-blue-400 dark:hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-50"
        >
          {next === 'in_progress' ? 'В работу' : 'Закрыть'}
        </button>
      )}
    </div>
  )
}
