'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reclamationsApi } from '@/lib/api/reclamations'
import { toFullUrl } from '@/lib/api/base-url'
import { fmtSize } from '@/components/cabinets/cabinet-dialog-shared'
import { useAuthStore } from '@/lib/store/auth'
import { AppModal } from '@/components/ui/app-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { UserDialog } from '@/components/users/user-dialog'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import { ProjectDetailDialog } from '@/components/projects/project-detail-dialog'
import { ImageLightbox } from '@/components/chats/attachment-view'
import { DialogHeader, DRow, DRowLink, fmtDate } from '@/components/requests/request-shared'
import { reclStatusCls, reclStatusLabel, reclObjectTypeLabel, reclWarrantyCls, reclWarrantyLabel } from './reclamation-shared'
import { BitrixDeletedCardWarning, BitrixPendingCreateBlock } from './bitrix-outbox-notice'

// Карточка только для просмотра: статус, гарантию, ответственного и срок
// выставляет специалист в Bitrix, к нам это приезжает вебхуком (см.
// README-backend.md, «Обработки через нашу админку нет»). Единственное, что
// можно сделать отсюда, — повторно отправить рекламацию в Bitrix, если она не
// доехала (BitrixPendingCreateBlock), и удалить, если карточку там удалили.
export function ReclamationDialog({ reclamationId, onClose }: { reclamationId: number; onClose: () => void }) {
  // Оператор видит карточку целиком, но очередь Bitrix (повторная отправка, снятие) и удаление — только админ.
  const isAdmin = useAuthStore(s => s.user?.role) !== 'operator'
  const [subUserId, setSubUserId] = useState<number | null>(null)
  const [subCabinetId, setSubCabinetId] = useState<number | null>(null)
  const [subProjectId, setSubProjectId] = useState<number | null>(null)

  const { data: r, isLoading, isError } = useQuery({
    queryKey: ['reclamation', reclamationId],
    queryFn: () => reclamationsApi.getOne(reclamationId),
    // Перебивает глобальные 30 секунд (providers.tsx): status, гарантия, срок и
    // ответственный приходят только вебхуком из Bitrix и меняются без нашего
    // участия, поэтому карточку читаем заново при каждом открытии.
    staleTime: 0,
    // Пока карточка открыта, специалист может поменять её в Bitrix — подхватываем.
    refetchInterval: 15_000,
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

          {isAdmin && (
            <>
              <BitrixDeletedCardWarning
                reclamationId={r.id}
                deletedAt={r.bitrix_deleted_at}
                itemId={r.bitrix_item_id}
                onDeleted={onClose}
              />
              <BitrixPendingCreateBlock item={r.pending_create_outbox} />
            </>
          )}

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
                  {r.object_details && <DRow label="Объект" value={<ObjectDetails details={r.object_details} />} />}
                </>
              ) : r.object_details ? (
                <DRow label="Объект" value={<ObjectDetails details={r.object_details} />} />
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

              {/* Всё ниже — из Bitrix, у нас только показывается. */}
              <DRow label="Статус" value={
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${reclStatusCls(r.status)}`}>
                  {reclStatusLabel(r.status)}
                </span>
              } />
              <DRow label="Гарантия" value={
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${reclWarrantyCls(r.warranty_classification)}`}>
                  {reclWarrantyLabel(r.warranty_classification)}
                </span>
              } />
              <DRow label="Ответственный" value={
                r.responsible_name
                  ? `${r.responsible_name}${r.responsible_phone ? ` · ${r.responsible_phone}` : ''}`
                  : '—'
              } />
              <DRow label="Срок отработки" value={r.deadline_at ? fmtDate(r.deadline_at) : '—'} />
              <DRow label="Решена" value={r.resolved_at ? fmtDate(r.resolved_at) : '—'} />

              {/* Эти поля никто больше не заполняет (ручки обработки нет) —
                  показываем исторический текст у старых рекламаций, если он есть. */}
              {r.rejection_reason && <DRow label="Причина отклонения" value={r.rejection_reason} />}
              {r.resolution_comment && <DRow label="Итоговый комментарий" value={r.resolution_comment} />}
              {r.root_cause && <DRow label="Коренная причина" value={r.root_cause} />}
              {r.confirmation_file_url && (
                <DRowLink
                  label="Подтверждающий документ"
                  value={r.confirmation_file_name || 'Скачать'}
                  onClick={() => window.open(toFullUrl(r.confirmation_file_url!), '_blank')}
                />
              )}
            </div>
          </div>

          <p className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
            Статус, гарантию, ответственного и срок меняет специалист в карточке Bitrix — здесь они обновляются сами.
          </p>
        </div>
      </AppModal>
      {subUserId !== null && <UserDialog userId={subUserId} role="user" onClose={() => setSubUserId(null)} />}
      {subCabinetId !== null && <CabinetDetailDialog cabinetId={subCabinetId} isAdmin onClose={() => setSubCabinetId(null)} />}
      <ProjectDetailDialog projectId={subProjectId} isAdmin onClose={() => setSubProjectId(null)} />
    </>
  )
}

function ObjectDetails({ details }: { details: Record<string, string> }) {
  return (
    <div className="space-y-0.5">
      {Object.entries(details).map(([k, v]) => (
        <p key={k} className="text-xs text-slate-500 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500">{k}:</span> {v}
        </p>
      ))}
    </div>
  )
}

function AttachmentRow({ a }: { a: { id: number; file_url: string; file_name: string; file_size_bytes: number; mime_type: string } }) {
  const [lightbox, setLightbox] = useState(false)
  const isImage = a.mime_type.startsWith('image/')
  const url = toFullUrl(a.file_url)

  return (
    <>
      <div
        onClick={() => isImage ? setLightbox(true) : window.open(url, '_blank')}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          {a.mime_type.includes('pdf')
            ? <PdfIcon className="w-3.5 h-3.5 text-red-500" />
            : isImage
            ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
            : <FileIcon className="w-3.5 h-3.5 text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{a.file_name}</p>
          <span className="text-[11px] text-slate-400">{fmtSize(a.file_size_bytes)}</span>
        </div>
      </div>
      {/* Фото открывается поверх модалки лайтбоксом (как в чатах), остальные
          файлы — отдельной вкладкой, им превью всё равно не нужно. */}
      {lightbox && <ImageLightbox url={url} name={a.file_name} onClose={() => setLightbox(false)} />}
    </>
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
