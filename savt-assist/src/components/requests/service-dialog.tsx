'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { requestsApi } from '@/lib/api/requests'
import type { ServiceRequest } from '@/lib/api/requests'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { UserDialog } from '@/components/users/user-dialog'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import {
  DialogHeader, DRow, DRowLink, VerifiedBadge, StatusStepper,
  fmtDate, userTypeLabel, svcStatusLabel, reqTypeLabel,
} from './request-shared'

export function ServiceDialog({ request, onClose }: { request: ServiceRequest; onClose: () => void }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(request.status)
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)

  const mutation = useMutation({
    mutationFn: () => requestsApi.updateServiceRequestStatus(request.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-requests'] })
      qc.invalidateQueries({ queryKey: ['dashboard-stats'] })
      toast.success('Статус обновлён')
      onClose()
    },
    onError: () => toast.error('Не удалось обновить статус'),
  })

  return (
    <AppModal open onClose={onClose}>
      {/* max-h + внутренний скролл — на низких экранах (320×480) длинный список полей
          не вылезает за пределы вьюпорта, шапка и кнопка сохранения остаются на месте */}
      <div className="flex flex-col max-h-[85vh]">
      <DialogHeader
        icon={<WrenchModalIcon />}
        title={`Заявка #${request.id}`}
        subtitle={`ШУ ${request.cabinet_object_number}`}
        badge={
          <div className="flex gap-1.5 flex-wrap">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              {svcStatusLabel(request.status)}
            </span>
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              {reqTypeLabel(request.request_type)}
            </span>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
      <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
        <DRowLink label="Пользователь" value={request.user_full_name ?? `#${request.user_id}`} onClick={() => setSubUserId(request.user_id)} />
        <DRow label="Телефон" value={request.user_phone ?? '—'} />
        <DRow label="Тип" value={userTypeLabel(request.user_type)} />
        {request.organization_name && <DRow label="Организация" value={request.organization_name} />}
        <DRow label="Статус аккаунта" value={<VerifiedBadge verified={request.user_is_verified} />} />
        {request.user_registered_at && <DRow label="Зарегистрирован" value={fmtDate(request.user_registered_at)} />}
        <DRowLink label="Шкаф управления" value={`ШУ ${request.cabinet_object_number}`} onClick={() => setSubCabinetId(request.cabinet_id)} />
        <DRow label="Создана" value={fmtDate(request.created_at)} />
        <DRow label="Закрыта" value={request.closed_at ? fmtDate(request.closed_at) : '—'} />
        <DRow label="Bitrix-задача" value={request.bitrix_task_id ?? '—'} />
        <div className="flex gap-3 sm:gap-4 px-4 sm:px-6 py-3">
          <span className="text-xs text-slate-400 w-20 sm:w-32 shrink-0 pt-0.5">Описание</span>
          <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {request.description}
          </p>
        </div>
      </div>
      </div>
      <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 mb-4">Изменить статус <b className='font-extrabold animate-pulse bg-gradient-to-r bg-clip-text  text-transparent from-indigo-500 via-purple-500 to-indigo-500 animate-text'>(кликабельно!)</b></p>
        <div className="mb-4">
          <StatusStepper status={status} onChange={setStatus} />
        </div>
        {status !== request.status && (
          <div className="flex justify-end">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        )}
      </div>
      </div>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin onClose={() => setSubCabinetId(null)} />}
    </AppModal>
  )
}

function WrenchModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>
}
