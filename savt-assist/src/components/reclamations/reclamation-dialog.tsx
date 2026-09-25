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
import { BitrixUserCombobox } from '@/components/ui/bitrix-user-combobox'
import { UserDialog } from '@/components/users/user-dialog'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { ProjectDetailDialog } from '@/components/projects/project-detail-dialog'
import { DialogHeader, DRow, DRowLink, fmtDate } from '@/components/requests/request-shared'
import { reclStatusCls, reclStatusLabel, reclObjectTypeLabel, reclWarrantyLabel } from './reclamation-shared'
import { BitrixDeletedCardWarning, BitrixOutboxCardWarning, useBitrixOutbox } from './bitrix-outbox-notice'

const STATUS_OPTIONS: ReclamationStatus[] = ['new', 'review', 'in_progress', 'resolved', 'rejected', 'invalid']

export function ReclamationDialog({ reclamationId, onClose }: { reclamationId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)
  const [subProjectId, setSubProjectId] = useState<number | null>(null)

  const { data: r, isLoading, isError } = useQuery({
    queryKey: ['reclamation', reclamationId],
    queryFn: () => reclamationsApi.getOne(reclamationId),
    // Перебивает глобальные 30 секунд (providers.tsx): deadline_at и стадия
    // синхронизируются с Bitrix в обе стороны и могут измениться на портале,
    // поэтому карточку читаем заново при каждом открытии.
    staleTime: 0,
  })

  const [status, setStatus] = useState<ReclamationStatus>('review')
  const [warranty, setWarranty] = useState<boolean | null>(null)
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  // Предвыбирается из r.responsible_bitrix_user_id при открытии — значение
  // синхронизируется с Bitrix в обе стороны (могли назначить прямо на
  // портале), сверять по одному только имени ненадёжно (см. README-backend.md).
  const [responsibleBitrixUserId, setResponsibleBitrixUserId] = useState<number | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [resolutionComment, setResolutionComment] = useState('')
  const [rootCause, setRootCause] = useState('')
  // Подтверждающий документ при закрытии (акт, фото выполненной работы) —
  // сервер требует его при переводе в resolved (400 без него), см. README-backend.md.
  const [confirmationFileUrl, setConfirmationFileUrl] = useState<string | null>(null)
  const [confirmationFileName, setConfirmationFileName] = useState<string | null>(null)
  // «ГГГГ-ММ-ДД» — ровно тот формат, что у <input type="date"> и у API.
  const [deadlineAt, setDeadlineAt] = useState('')
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
    setResponsibleBitrixUserId(r.responsible_bitrix_user_id ?? null)
    setRejectionReason(r.rejection_reason ?? '')
    setResolutionComment(r.resolution_comment ?? '')
    setRootCause(r.root_cause ?? '')
    setConfirmationFileUrl(r.confirmation_file_url ?? null)
    setConfirmationFileName(r.confirmation_file_name ?? null)
    setDeadlineAt(r.deadline_at ?? '')
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

  // deadline_at требует Bitrix для всех переходов КРОМЕ new/review — эти две
  // стадии карточку между собой в Bitrix ещё не двигают (см. README-backend.md).
  const needsDeadline = status !== 'new' && status !== 'review'
  // Поле «Ответственный» теперь в общем списке (не привязано к статусу, см.
  // DRow «Ответственный» ниже) — список сотрудников Bitrix грузится сразу при
  // открытии карточки, не дожидаясь конкретного статуса.
  const { data: bitrixUsers = [], isLoading: bitrixUsersLoading, isError: bitrixUsersError } = useQuery({
    queryKey: ['reclamation-bitrix-users'],
    queryFn: reclamationsApi.getBitrixUsers,
  })

  // Застрявшая синхронизация именно этой рекламации — объясняет ситуацию
  // «в админке поменяли, а в Bitrix ничего не поменялось» прямо в карточке.
  const { data: outbox = [] } = useBitrixOutbox(true)
  const outboxForThis = outbox.filter(i => i.reclamation_id === reclamationId)

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

  const needsReason = status === 'rejected' || status === 'invalid'
  // Подтверждающий документ обязателен при ВСЕХ закрывающих статусах, не
  // только при resolved (см. README-backend.md, «Рут reclamations»).
  const needsConfirmation = status === 'resolved' || needsReason

  // Обязательные проверки на сервере срабатывают только «при смене статуса»
  // (см. README-backend.md, §3) — если статус не меняется (например, карточка
  // уже in_progress, а админ просто добавляет срок отработки), сервер их не
  // требует, и клиент не должен требовать тоже.
  const isTransitioning = status !== r.status

  // Гарантия и ответственный не блокируют сохранение (см. missing ниже), но
  // сервер их всё равно требует при переходе в in_progress/resolved и без них
  // отклонит запрос 400-кой — вместо того чтобы узнавать об этом только после
  // клика «Сохранить», подсказываем заранее прямо у полей (тот же приём, что
  // и у «Срок отработки»).
  const wantsWarrantyAndResponsible = isTransitioning && (status === 'in_progress' || status === 'resolved')

  // Валидация — только то, что реально блокирует сервер 400-кой. Ответственный
  // и гарантия сюда намеренно не входят — необязательные поля, ограничивать
  // сохранение ими не нужно (сервер и так проверит своё, если что-то важное
  // не так, ошибка придёт тостом).
  const missing: string[] = []
  if (isTransitioning) {
    if (needsReason && !rejectionReason.trim()) missing.push('причину')
    if (status === 'resolved' && !resolutionComment.trim()) missing.push('итоговый комментарий')
    if (needsConfirmation && !confirmationFileUrl) missing.push('подтверждающий документ')
  }
  const validationError = missing.length > 0
    ? `Для перехода в «${reclStatusLabel(status)}» нужно указать: ${missing.join(', ')}`
    : null

  const buildPatch = () => {
    const patch: Parameters<typeof reclamationsApi.update>[1] = {}
    if (status !== r.status) patch.status = status
    if (warranty !== r.warranty_classification) patch.warranty_classification = warranty
    if (responsibleName.trim() !== (r.responsible_name ?? '')) patch.responsible_name = responsibleName.trim() || null
    if (responsiblePhone.trim() !== (r.responsible_phone ?? '')) patch.responsible_phone = responsiblePhone.trim() || null
    if (responsibleBitrixUserId !== (r.responsible_bitrix_user_id ?? null)) {
      patch.responsible_bitrix_user_id = responsibleBitrixUserId
    }
    if (rejectionReason.trim() !== (r.rejection_reason ?? '')) patch.rejection_reason = rejectionReason.trim() || null
    if (resolutionComment.trim() !== (r.resolution_comment ?? '')) patch.resolution_comment = resolutionComment.trim() || null
    if (rootCause.trim() !== (r.root_cause ?? '')) patch.root_cause = rootCause.trim() || null
    if (confirmationFileUrl !== (r.confirmation_file_url ?? null)) patch.confirmation_file_url = confirmationFileUrl
    if ((confirmationFileName ?? '') !== (r.confirmation_file_name ?? '')) patch.confirmation_file_name = confirmationFileName || null
    if (deadlineAt !== (r.deadline_at ?? '')) patch.deadline_at = deadlineAt || null
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

          <BitrixDeletedCardWarning
            reclamationId={r.id}
            deletedAt={r.bitrix_deleted_at}
            itemId={r.bitrix_item_id}
            onDeleted={onClose}
          />
          <BitrixOutboxCardWarning items={outboxForThis} />

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
              <DRowLink label="Подал" value={r.user_full_name ?? `#${r.user_id}`} onClick={() => setSubUserId(r.user_id)} />
              <DRow label="Контакт" value={`${r.contact_name} · ${r.contact_phone}`} />
              <DRow label="Email" value={r.contact_email} />
              {r.customer_name && <DRow label="Заказчик" value={r.customer_name} />}
              <DRow label="Тип объекта" value={reclObjectTypeLabel(r.object_type)} />
              {r.object_type === 'cabinet' && r.cabinet_id != null ? (
                <DRowLink label="Объект" value={`ШУ ${r.cabinet_object_number}`} onClick={() => setSubCabinetId(r.cabinet_id)} />
              ) : r.project_id != null ? (
                <>
                  <DRowLink label="Проект" value={r.project_name ?? `#${r.project_id}`} onClick={() => setSubProjectId(r.project_id)} />
                  {r.object_details && (
                    <DRow label="Объект" value={
                      <div className="space-y-0.5">
                        {Object.entries(r.object_details).map(([k, v]) => (
                          <p key={k} className="text-xs text-slate-500 dark:text-slate-400">
                            <span className="text-slate-400 dark:text-slate-500">{k}:</span> {v}
                          </p>
                        ))}
                      </div>
                    } />
                  )}
                </>
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
              <DRow label="Срок отработки" value={r.deadline_at ? fmtDate(r.deadline_at) : '—'} />
              {/* Гарантия и ответственный — необязательные поля, не условие
                  перехода статуса (клиент их для этого не требует, см.
                  validationError ниже), поэтому живут здесь, в общем списке
                  полей, а не в блоке «Обработка»: проставить можно на любом
                  этапе. */}
              <DRow label="Гарантия" value={
                <div>
                  <select
                    value={warranty === null ? '' : warranty ? 'true' : 'false'}
                    onChange={e => setWarranty(e.target.value === '' ? null : e.target.value === 'true')}
                    className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] cursor-pointer"
                  >
                    <option value="">Не классифицирована</option>
                    <option value="true">Гарантийный случай</option>
                    <option value="false">Платно</option>
                  </select>
                  {wantsWarrantyAndResponsible && warranty == null && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Не классифицирована — без этого Bitrix откажет в переходе в «{reclStatusLabel(status)}».
                    </p>
                  )}
                </div>
              } />
              <DRow label="Ответственный" value={
                <div>
                  {responsibleName && (
                    <p className="text-sm text-slate-700 dark:text-slate-200 mb-1.5">
                      {responsibleName}{responsiblePhone && ` · ${responsiblePhone}`}
                    </p>
                  )}
                  <BitrixUserCombobox
                    users={bitrixUsers}
                    isLoading={bitrixUsersLoading}
                    isError={bitrixUsersError}
                    placeholder={responsibleName ? 'Назначить другого...' : 'Выберите ответственного...'}
                    onChange={u => {
                      // full_name/phone из Bitrix бывают пустыми (см.
                      // BitrixUserCombobox) — responsibleName/responsiblePhone
                      // здесь всегда обычная строка, не null.
                      setResponsibleBitrixUserId(u.id)
                      setResponsibleName(u.full_name ?? '')
                      setResponsiblePhone(u.phone ?? '')
                    }}
                  />
                  {wantsWarrantyAndResponsible && !responsibleName.trim() && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Не назначен — без этого Bitrix откажет в переходе в «{reclStatusLabel(status)}».
                    </p>
                  )}
                </div>
              } />
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

            {/* Поле, а не только предупреждение, показывается только там, где
                Bitrix реально требует дедлайн для перехода (needsDeadline) —
                на new/review его нет смысла даже предлагать заполнить. */}
            {needsDeadline && (
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                  Срок отработки
                </label>
                <input
                  type="date"
                  value={deadlineAt}
                  onChange={e => setDeadlineAt(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
                {/* Сервер обещает подставлять «сегодня + 7 дней», но на
                    практике переход всё равно отваливался с
                    CRM_FIELD_ERROR_REQUIRED и падал в очередь повторов,
                    поэтому предупреждаем заранее, а не полагаемся на заглушку. */}
                {!deadlineAt && status !== r.status && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Срок не задан — Bitrix требует «Дедлайн» при переходе в этот статус, без него переход на портале может не пройти. Лучше указать реальный.
                  </p>
                )}
              </div>
            )}

            {/* rejection_reason обязателен и для «Отклонена», и для «Ошибочной»
                (см. README-backend.md) — поле общее, меняется только подсказка. */}
            {needsReason && (
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder={status === 'invalid' ? 'Чем рекламация оформлена некорректно' : 'Причина отклонения'}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
              />
            )}

            {status === 'resolved' && (
              <textarea
                value={resolutionComment}
                onChange={e => setResolutionComment(e.target.value)}
                placeholder="Итоговый комментарий"
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
              />
            )}

            {/* Акт, фото выполненной работы и т.п. Обязателен при всех трёх
                закрывающих статусах — «Закрыта», «Отклонена» и «Ошибочная»
                (см. README-backend.md), а не только при закрытии. */}
            {needsConfirmation && (
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
                  Подтверждающий документ <span className="text-red-500">*</span>
                </label>
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
      <ProjectDetailDialog projectId={subProjectId} isAdmin onClose={() => setSubProjectId(null)} />
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
