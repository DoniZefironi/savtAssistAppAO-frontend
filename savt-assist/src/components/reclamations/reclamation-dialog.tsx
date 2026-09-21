'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { reclamationsApi } from '@/lib/api/reclamations'
import type { ReclamationStatus } from '@/types'
import { apiErrorMessage } from '@/lib/api/errors'
import { toFullUrl } from '@/lib/api/base-url'
import { fmtSize } from '@/components/cabinets/cabinet-dialog-shared'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SpinnerIcon } from '@/components/ui/icons'
import { UserDialog } from '@/components/users/user-dialog'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { DialogHeader, DRow, DRowLink, fmtDate } from '@/components/requests/request-shared'
import { reclStatusCls, reclStatusLabel, reclObjectTypeLabel, reclWarrantyCls, reclWarrantyLabel } from './reclamation-shared'

const STATUS_OPTIONS: ReclamationStatus[] = ['review', 'in_progress', 'resolved', 'rejected']

export function ReclamationDialog({ reclamationId, onClose }: { reclamationId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)

  const { data: r, isLoading, isError } = useQuery({
    queryKey: ['reclamation', reclamationId],
    queryFn: () => reclamationsApi.getOne(reclamationId),
  })

  const [status, setStatus] = useState<ReclamationStatus>('review')
  const [warranty, setWarranty] = useState<boolean | null>(null)
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [resolutionComment, setResolutionComment] = useState('')
  const [rootCause, setRootCause] = useState('')
  // Подтверждающий документ при закрытии (акт, фото выполненной работы) —
  // сервер требует его при переводе в resolved (400 без него), см. README-backend.md.
  const [confirmationFileUrl, setConfirmationFileUrl] = useState<string | null>(null)
  const [confirmationFileName, setConfirmationFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Черновик формы подхватывает данные с сервера только когда они пришли —
  // тот же приём, что и в других формах настроек в этом проекте (см.
  // settings/page.tsx, PromoScheduleSection).
  useEffect(() => {
    if (!r) return
    setStatus(r.status)
    setWarranty(r.warranty_classification)
    setResponsibleName(r.responsible_name ?? '')
    setResponsiblePhone(r.responsible_phone ?? '')
    setRejectionReason(r.rejection_reason ?? '')
    setResolutionComment(r.resolution_comment ?? '')
    setRootCause(r.root_cause ?? '')
    setConfirmationFileUrl(r.confirmation_file_url ?? null)
    setConfirmationFileName(r.confirmation_file_name ?? null)
  }, [r])

  // Загружается сразу по выбору файла (тот же принцип, что и вложения при
  // подаче самой рекламации) — сохраняется в форме только готовый url, не
  // сам File; PATCH уходит отдельно, по кнопке «Сохранить».
  const uploadMut = useMutation({
    mutationFn: (file: File) => reclamationsApi.uploadAttachment(file),
    onSuccess: (res, file) => {
      setConfirmationFileUrl(res.url)
      setConfirmationFileName(file.name)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось загрузить файл')),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMut.mutate(file)
    e.target.value = ''
  }

  const saveMut = useMutation({
    mutationFn: (patch: Parameters<typeof reclamationsApi.update>[1]) => reclamationsApi.update(reclamationId, patch),
    onSuccess: (res) => {
      qc.setQueryData(['reclamation', reclamationId], res)
      qc.invalidateQueries({ queryKey: ['reclamations'] })
      toast.success('Рекламация обновлена')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
  })

  if (!r) {
    return (
      <AppModal open onClose={onClose}>
        <div className="p-6">
          {isLoading && <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div>}
          {isError && <p className="text-sm text-slate-400">Не удалось загрузить рекламацию</p>}
        </div>
      </AppModal>
    )
  }

  // Валидация — те же правила, что и на сервере (см. README-backend.md, «Рут
  // reclamations», PATCH /admin/reclamations/{id}), чтобы не ловить 400
  // вслепую: показываем причину прямо в форме, до отправки.
  let validationError: string | null = null
  if (status === 'rejected' && !rejectionReason.trim()) validationError = 'Укажите причину отклонения'
  else if (status === 'resolved' && !resolutionComment.trim() && !confirmationFileUrl) {
    validationError = 'Укажите итоговый комментарий и приложите подтверждающий документ'
  }
  else if (status === 'resolved' && !resolutionComment.trim()) validationError = 'Укажите итоговый комментарий'
  else if (status === 'resolved' && !confirmationFileUrl) validationError = 'Приложите подтверждающий документ — без него рекламацию нельзя закрыть'
  else if (status === 'in_progress' && (!responsibleName.trim() || warranty == null)) {
    validationError = 'Для статуса «В работе» нужны ответственный и гарантийная классификация'
  }

  const buildPatch = () => {
    const patch: Parameters<typeof reclamationsApi.update>[1] = {}
    if (status !== r.status) patch.status = status
    if (warranty !== r.warranty_classification) patch.warranty_classification = warranty
    if (responsibleName.trim() !== (r.responsible_name ?? '')) patch.responsible_name = responsibleName.trim() || null
    if (responsiblePhone.trim() !== (r.responsible_phone ?? '')) patch.responsible_phone = responsiblePhone.trim() || null
    if (rejectionReason.trim() !== (r.rejection_reason ?? '')) patch.rejection_reason = rejectionReason.trim() || null
    if (resolutionComment.trim() !== (r.resolution_comment ?? '')) patch.resolution_comment = resolutionComment.trim() || null
    if (rootCause.trim() !== (r.root_cause ?? '')) patch.root_cause = rootCause.trim() || null
    if (confirmationFileUrl !== (r.confirmation_file_url ?? null)) patch.confirmation_file_url = confirmationFileUrl
    if ((confirmationFileName ?? '') !== (r.confirmation_file_name ?? '')) patch.confirmation_file_name = confirmationFileName || null
    return patch
  }

  const patch = buildPatch()
  const hasChanges = Object.keys(patch).length > 0
  const canSave = hasChanges && !validationError && !saveMut.isPending && !uploadMut.isPending

  return (
    <>
      <AppModal open onClose={onClose}>
        <div className="flex flex-col max-h-[85vh] min-w-0">
          <DialogHeader
            icon={<ReclamationModalIcon />}
            title={`Рекламация #${r.id}`}
            subtitle={r.object_type === 'cabinet' && r.cabinet_object_number ? `ШУ ${r.cabinet_object_number}` : reclObjectTypeLabel(r.object_type)}
            badge={
              <div className="flex gap-1.5 flex-wrap">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                  {reclStatusLabel(r.status)}
                </span>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                  {reclWarrantyLabel(r.warranty_classification)}
                </span>
              </div>
            }
          />

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              <DRowLink label="Подал" value={r.user_full_name ?? `#${r.user_id}`} onClick={() => setSubUserId(r.user_id)} />
              <DRow label="Контакт" value={`${r.contact_name} · ${r.contact_phone}`} />
              <DRow label="Email" value={r.contact_email} />
              {r.customer_name && <DRow label="Заказчик" value={r.customer_name} />}
              <DRow label="Тип объекта" value={reclObjectTypeLabel(r.object_type)} />
              {r.object_type === 'cabinet' && r.cabinet_id != null ? (
                <DRowLink label="Объект" value={`ШУ ${r.cabinet_object_number}`} onClick={() => setSubCabinetId(r.cabinet_id)} />
              ) : r.object_details ? (
                <DRow label="Объект" value={
                  <div className="space-y-0.5">
                    {Object.entries(r.object_details).map(([k, v]) => (
                      <p key={k} className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="text-slate-400 dark:text-slate-500">{k}:</span> {v}
                      </p>
                    ))}
                  </div>
                } />
              ) : null}
              {r.contract_number && <DRow label="Договор" value={r.contract_number} />}
              {r.order_number && <DRow label="Заказ" value={r.order_number} />}
              {r.ttn_number && <DRow label="ТТН" value={r.ttn_number} />}
              {r.error_codes && <DRow label="Коды ошибок" value={r.error_codes} />}
              <div className="flex gap-3 sm:gap-4 px-4 sm:px-6 py-3">
                <span className="text-xs text-slate-400 w-20 sm:w-32 shrink-0 pt-0.5">Описание</span>
                <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{r.description}</p>
              </div>
              {r.occurrence_conditions && (
                <div className="flex gap-3 sm:gap-4 px-4 sm:px-6 py-3">
                  <span className="text-xs text-slate-400 w-20 sm:w-32 shrink-0 pt-0.5">Условия проявления</span>
                  <p className="flex-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{r.occurrence_conditions}</p>
                </div>
              )}
              {r.attachments.length > 0 && (
                <div className="px-4 sm:px-6 py-3">
                  <span className="text-xs text-slate-400 block mb-2">Вложения</span>
                  <div className="space-y-1.5">
                    {r.attachments.map(a => <AttachmentRow key={a.id} a={a} />)}
                  </div>
                </div>
              )}
              <DRow label="Подана" value={fmtDate(r.created_at)} />
              <DRow label="Решена" value={r.resolved_at ? fmtDate(r.resolved_at) : '—'} />
              {r.rejection_reason && <DRow label="Причина отклонения" value={r.rejection_reason} />}
              {r.resolution_comment && <DRow label="Итоговый комментарий" value={r.resolution_comment} />}
              {r.confirmation_file_url && (
                <DRowLink
                  label="Подтверждающий документ"
                  value={r.confirmation_file_name || 'Скачать'}
                  onClick={() => window.open(toFullUrl(r.confirmation_file_url!), '_blank')}
                />
              )}
              {(r.responsible_name || r.responsible_phone) && (
                <DRow label="Ответственный" value={[r.responsible_name, r.responsible_phone].filter(Boolean).join(' · ')} />
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Обработка</p>

            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    status === s ? reclStatusCls(s) + ' border-transparent' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {reclStatusLabel(s)}
                </button>
              ))}
            </div>

            {(status === 'in_progress' || status === 'resolved') && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setWarranty(true)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    warranty === true ? reclWarrantyCls(true) + ' border-transparent' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  Гарантийный случай
                </button>
                <button
                  onClick={() => setWarranty(false)}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    warranty === false ? reclWarrantyCls(false) + ' border-transparent' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  Платно
                </button>
              </div>
            )}

            {(status === 'in_progress' || status === 'resolved') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={responsibleName}
                  onChange={e => setResponsibleName(e.target.value)}
                  placeholder="Ответственный (ФИО)"
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
                <input
                  value={responsiblePhone}
                  onChange={e => setResponsiblePhone(e.target.value)}
                  placeholder="Рабочий телефон"
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
              </div>
            )}

            {status === 'rejected' && (
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="Причина отклонения"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
              />
            )}

            {status === 'resolved' && (
              <div className="space-y-2">
                <textarea
                  value={resolutionComment}
                  onChange={e => setResolutionComment(e.target.value)}
                  placeholder="Итоговый комментарий"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
                />
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                    Подтверждающий документ <span className="text-red-500">*</span>
                  </label>
                  {/* Акт, фото выполненной работы и т.п. — сервер требует его
                      при переводе в resolved, 400 без него (см. README-backend.md). */}
                  {confirmationFileUrl ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50">
                      <FileIcon className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200 truncate">
                        {confirmationFileName || 'Файл загружен'}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setConfirmationFileUrl(null); setConfirmationFileName(null) }}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                      >
                        Заменить
                      </button>
                    </div>
                  ) : (
                    <>
                      <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadMut.isPending}
                        className="cursor-pointer"
                      >
                        {uploadMut.isPending
                          ? <><SpinnerIcon className="w-4 h-4 mr-1.5 animate-spin" />Загрузка...</>
                          : 'Прикрепить файл'
                        }
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            <textarea
              value={rootCause}
              onChange={e => setRootCause(e.target.value)}
              placeholder="Коренная причина (необязательно)"
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
            />

            {validationError && hasChanges && <p className="text-xs text-red-500">{validationError}</p>}

            <div className="flex justify-end">
              <Button
                onClick={() => saveMut.mutate(patch)}
                disabled={!canSave}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {saveMut.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        </div>
      </AppModal>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin onClose={() => setSubCabinetId(null)} />}
    </>
  )
}

function AttachmentRow({ a }: { a: { id: number; file_url: string; file_name: string; file_size_bytes: number; mime_type: string } }) {
  return (
    <div
      onClick={() => window.open(toFullUrl(a.file_url), '_blank')}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
    >
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
        {a.mime_type.includes('pdf')
          ? <PdfIcon className="w-3.5 h-3.5 text-red-500" />
          : a.mime_type.startsWith('image/')
          ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
          : <FileIcon className="w-3.5 h-3.5 text-slate-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{a.file_name}</p>
        <span className="text-[11px] text-slate-400">{fmtSize(a.file_size_bytes)}</span>
      </div>
    </div>
  )
}

function ReclamationModalIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
}
function PdfIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
}
function ImageIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
}
function FileIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
}
