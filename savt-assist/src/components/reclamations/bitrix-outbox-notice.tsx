'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { reclamationsApi } from '@/lib/api/reclamations'
import { apiErrorMessage } from '@/lib/api/errors'
import type { ReclamationBitrixDetachedItem, ReclamationBitrixOutboxItem } from '@/types'
import { reclStatusLabel } from './reclamation-shared'

const OPERATION_LABEL: Record<ReclamationBitrixOutboxItem['operation'], string> = {
  create: 'создание карточки',
  status: 'смена стадии',
  assignee: 'назначение ответственного',
  deadline: 'срок отработки',
  warranty: 'гарантия',
  comment: 'комментарий в таймлайн',
}

// Один общий queryKey на все места (список рекламаций и карточка) — react-query
// сам дедуплицирует запрос, второго обращения к бэкенду не будет.
const OUTBOX_QUERY = {
  queryKey: ['reclamation-bitrix-outbox'],
  queryFn: reclamationsApi.getBitrixOutbox,
} as const

export function useBitrixOutbox(enabled: boolean) {
  return useQuery({ ...OUTBOX_QUERY, enabled })
}

export function useBitrixDetached(enabled: boolean) {
  return useQuery({
    queryKey: ['reclamation-bitrix-detached'],
    queryFn: reclamationsApi.getBitrixDetached,
    enabled,
  })
}

// Удаление отвязанной от Bitrix рекламации. Нативный confirm(), как и у
// остальных необратимых удалений в админке (адрес целиком на карте регистров,
// заготовки рассылки), — но с явным «окончательно» в тексте: заявитель её тоже
// больше не увидит. Сервер разрешает удаление только для рекламаций из
// bitrix-detached, поэтому и кнопка есть только в этих двух местах.
export function useDeleteReclamation(onDeleted?: (id: number) => void) {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (id: number) => reclamationsApi.remove(id),
    onSuccess: (_, id) => {
      // Сначала закрываем открытую карточку, и только потом чистим её кэш —
      // иначе ещё смонтированный диалог успел бы перезапросить уже удалённую
      // рекламацию и показать 404 вместо того, чтобы просто закрыться.
      onDeleted?.(id)
      qc.removeQueries({ queryKey: ['reclamation', id] })
      qc.invalidateQueries({ queryKey: ['reclamation-bitrix-detached'] })
      qc.invalidateQueries({ queryKey: ['reclamation-bitrix-outbox'] })
      qc.invalidateQueries({ queryKey: ['reclamations'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Рекламация удалена')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось удалить рекламацию')),
  })
  const confirmAndDelete = (id: number) => {
    if (window.confirm(
      `Удалить рекламацию #${id} окончательно?\n\nВместе с ней удалятся вложения, у заявителя она тоже пропадёт. Отменить нельзя.`
    )) mut.mutate(id)
  }
  return { confirmAndDelete, isPending: mut.isPending, pendingId: mut.isPending ? mut.variables : undefined }
}

// Ручная правка payload + немедленная попытка отправки. success:false — не
// HTTP-ошибка, а «снова не прошло»: row несёт обновлённый last_error, тост
// показывает его же, чтобы сразу было видно, чего ещё не хватает.
function useUpdateBitrixOutboxRow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, unknown> }) =>
      reclamationsApi.updateBitrixOutbox(id, payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reclamation-bitrix-outbox'] })
      if (res.success) toast.success('Отправлено в Bitrix')
      else toast.error(res.row?.last_error ? `Снова не прошло: ${res.row.last_error}` : 'Снова не удалось отправить')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить правку')),
  })
}

// Снять операцию с повторов насовсем — необратимо (если не почините вручную,
// она никогда не уйдёт в Bitrix), поэтому тоже через confirm(), как и
// удаление самой рекламации.
function useDeleteBitrixOutboxRow() {
  const qc = useQueryClient()
  const mut = useMutation({
    mutationFn: (id: number) => reclamationsApi.deleteBitrixOutbox(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reclamation-bitrix-outbox'] })
      toast.success('Снято с повторов')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось снять с очереди')),
  })
  const confirmAndRemove = (id: number) => {
    if (window.confirm('Снять операцию с повторов насовсем?\n\nЕсли не починить вручную, она никогда не уйдёт в Bitrix. Отменить нельзя.')) {
      mut.mutate(id)
    }
  }
  return { confirmAndRemove, pendingId: mut.isPending ? mut.variables : undefined }
}

function fmtWhen(iso: string | null): string {
  if (!iso) return 'ещё не пробовали'
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Строка одной застрявшей операции — общая и для списка на странице
// рекламаций, и для предупреждения внутри конкретной карточки. payload
// показываем свёрнутым по умолчанию (строгой схемы под него нет, состав
// ключей отличается по operation — незачем показывать сырой JSON, пока не
// понадобилось), «Редактировать и повторить» разворачивает его в текстовое
// поле поверх того же payload, а не открывает отдельную модалку.
function OutboxRow({ item, showReclamationId = true }: { item: ReclamationBitrixOutboxItem; showReclamationId?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const updateMut = useUpdateBitrixOutboxRow()
  const { confirmAndRemove, pendingId: deletePendingId } = useDeleteBitrixOutboxRow()

  const startEdit = () => {
    setEditText(JSON.stringify(item.payload, null, 2))
    setEditing(true)
    setExpanded(true)
  }

  const submitEdit = () => {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(editText)
    } catch {
      toast.error('Невалидный JSON')
      return
    }
    updateMut.mutate({ id: item.id, payload }, {
      // Закрываем форму только если реально прошло — на повторном сбое
      // оставляем как есть, чтобы можно было тут же поправить ещё раз, не
      // печатая payload заново.
      onSuccess: (res) => { if (res.success) setEditing(false) },
    })
  }

  return (
    <div className="rounded-lg bg-white/70 dark:bg-slate-800/60 border border-amber-100 dark:border-amber-900/40 px-3 py-2">
      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
        {showReclamationId && <>Рекламация #{item.reclamation_id} · </>}
        {OPERATION_LABEL[item.operation]} · попыток: {item.attempts}
      </p>
      {item.last_error && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 wrap-break-word">{item.last_error}</p>
      )}
      <p className="text-[11px] text-slate-400 mt-0.5">Последняя попытка: {fmtWhen(item.last_attempted_at)}</p>

      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
        <button type="button" onClick={() => setExpanded(v => !v)} className="text-xs text-amber-700 dark:text-amber-400 hover:underline cursor-pointer">
          {expanded ? 'Скрыть payload' : 'Показать payload'}
        </button>
        {!editing && (
          <button type="button" onClick={startEdit} className="text-xs text-amber-700 dark:text-amber-400 hover:underline cursor-pointer">
            Редактировать и повторить
          </button>
        )}
        <button
          type="button"
          onClick={() => confirmAndRemove(item.id)}
          disabled={deletePendingId === item.id}
          className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
        >
          {deletePendingId === item.id ? 'Снятие...' : 'Снять с очереди'}
        </button>
      </div>

      {expanded && (
        editing ? (
          <div className="mt-2 space-y-1.5">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-y"
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(false)} disabled={updateMut.isPending} className="text-xs text-slate-500 dark:text-slate-400 hover:underline cursor-pointer disabled:opacity-50">
                Отмена
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={updateMut.isPending}
                className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline cursor-pointer disabled:opacity-50"
              >
                {updateMut.isPending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        ) : (
          <pre className="mt-2 px-2 py-1.5 text-[11px] font-mono rounded-lg bg-black/5 dark:bg-black/30 text-slate-600 dark:text-slate-300 overflow-x-auto">
            {JSON.stringify(item.payload, null, 2)}
          </pre>
        )
      )}
    </div>
  )
}

// Плашка над списком рекламаций: в норме очередь пуста и не видно ничего
// вообще. Отдельного экрана нет намеренно — застрявшая операция важна ровно
// в тот момент, когда сломалась, а экран, который открывают раз в месяц,
// этого не показывает. Список read-only: повторы делает фоновая задача
// каждые 15 минут, кнопки «повторить сейчас» в API нет.
export function BitrixOutboxNotice({ items }: { items: ReclamationBitrixOutboxItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="flex-1 min-w-0 text-sm text-amber-700 dark:text-amber-300">
          {items.length === 1
            ? 'Одна операция не ушла в Bitrix'
            : `${items.length} операций не ушли в Bitrix`} — эти рекламации разъехались с порталом
        </span>
        <ChevronDown className={cn('w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden min-h-0">
          <div className="px-3 sm:px-4 pb-3 space-y-2">
            {items.map(i => <OutboxRow key={i.id} item={i} />)}
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
              Повтор идёт сам каждые 15 минут — «Редактировать и повторить» пробует сразу же, не дожидаясь цикла.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Заявки, чью карточку удалили в Bitrix. Соседствует с плашкой недоставленных
// операций и ведёт себя так же: пусто — не видно ничего. Отличие по смыслу —
// это не «ещё не доехало, повторим», а «связи с порталом больше нет и сама она
// не восстановится»: решение (заводить заново или закрывать) за админом,
// поэтому и тон у плашки более настойчивый.
export function BitrixDetachedNotice({ items, onOpen }: {
  items: ReclamationBitrixDetachedItem[]
  onOpen?: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const { confirmAndDelete, pendingId } = useDeleteReclamation()
  if (items.length === 0) return null

  return (
    <div className="mb-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 overflow-hidden">
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 cursor-pointer hover:bg-red-100/60 dark:hover:bg-red-900/30 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
        <span className="flex-1 min-w-0 text-sm text-red-700 dark:text-red-300">
          {items.length === 1
            ? 'У одной рекламации удалили карточку в Bitrix'
            : `У ${items.length} рекламаций удалили карточки в Bitrix`} — сами они туда не вернутся
        </span>
        <ChevronDown className={cn('w-4 h-4 text-red-600 dark:text-red-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </div>

      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden min-h-0">
          <div className="px-3 sm:px-4 pb-3 space-y-2">
            {items.map(i => (
              <div
                key={i.id}
                onClick={onOpen ? () => onOpen(i.id) : undefined}
                className={cn(
                  'flex items-start gap-3 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-red-100 dark:border-red-900/40 px-3 py-2',
                  onOpen && 'cursor-pointer hover:bg-white dark:hover:bg-slate-800'
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    Рекламация #{i.id} · {reclStatusLabel(i.status)}
                    {i.user_full_name ? ` · ${i.user_full_name}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{i.description}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Карточку в Bitrix удалили {fmtWhen(i.bitrix_deleted_at)}</p>
                </div>
                {/* stopPropagation — иначе клик по «Удалить» заодно открывал бы
                    карточку рекламации под подтверждением. */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); confirmAndDelete(i.id) }}
                  disabled={pendingId === i.id}
                  className="shrink-0 text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
                >
                  {pendingId === i.id ? 'Удаление...' : 'Удалить'}
                </button>
              </div>
            ))}
            <p className="text-[11px] text-red-700/80 dark:text-red-400/80">
              Заявки живы и работают у нас — решите по каждой: завести в Bitrix заново, закрыть или удалить окончательно.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// То же самое, но про одну конкретную рекламацию — внутри её карточки.
// Объясняет ровно ту ситуацию, из-за которой обычно и приходят с вопросами:
// в админке поменяли, а в Bitrix «ничего не происходит».
export function BitrixOutboxCardWarning({ items }: { items: ReclamationBitrixOutboxItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="px-4 sm:px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-y border-amber-100 dark:border-amber-900/40 space-y-2">
      {items.map(i => <OutboxRow key={i.id} item={i} showReclamationId={false} />)}
    </div>
  )
}

// Карточку этой рекламации удалили в Bitrix. Отличать от «ещё не уехала»
// нужно по паре полей: удалённая — это заполненный bitrix_deleted_at при
// пустом bitrix_item_id, а когда пусты оба, она просто ещё не доехала.
export function BitrixDeletedCardWarning({ reclamationId, deletedAt, itemId, onDeleted }: {
  reclamationId: number
  deletedAt: string | null
  itemId: string | null
  onDeleted: () => void
}) {
  const { confirmAndDelete, isPending } = useDeleteReclamation(onDeleted)
  if (!deletedAt || itemId) return null
  return (
    <div className="px-4 sm:px-6 py-3 bg-red-50 dark:bg-red-900/20 border-y border-red-100 dark:border-red-900/40">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-red-700 dark:text-red-300">
            Карточку в Bitrix удалили {fmtWhen(deletedAt)}. Рекламация работает у нас, но с порталом больше не связана
            и сама туда не вернётся — её нужно завести в Bitrix заново, закрыть здесь или удалить окончательно.
          </p>
          <button
            type="button"
            onClick={() => confirmAndDelete(reclamationId)}
            disabled={isPending}
            className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer disabled:opacity-50"
          >
            {isPending ? 'Удаление...' : 'Удалить рекламацию'}
          </button>
        </div>
      </div>
    </div>
  )
}
