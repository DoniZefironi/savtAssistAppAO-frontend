'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { botApi } from '@/lib/api/bot'
import type { PromoMessage } from '@/lib/api/bot'
import { apiErrorMessage } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { ProjectCombobox } from '@/components/ui/project-combobox'
import { PillButton } from '@/components/ui/pill-button'
import { useAuthStore } from '@/lib/store/auth'
import { SpinnerIcon, PlusIcon } from '@/components/ui/icons'

export default function AdminSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()
  const isOperator = user?.role === 'operator'

  // Рассылка push-уведомлений — только для администратора (см. README-backend.md:
  // POST /admin/notifications/broadcast вернёт 403 оператору). Ссылка на страницу
  // скрыта в навигации (admin-sidebar.tsx, admin-header.tsx), но при прямом переходе
  // по URL без этой проверки оператор увидел бы всю форму до клика.
  useEffect(() => {
    if (isOperator) router.replace('/operator/dashboard')
  }, [isOperator, router])

  if (isOperator) return null

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="max-w-300 mx-auto w-full">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Настройки</h1>
          <p className="text-sm text-slate-400 mt-0.5">Управление системой и инструменты администратора</p>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 sm:py-6">
        <div className="max-w-300 mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="lg:col-span-2">
            <BroadcastSection />
          </div>
          <div className="lg:col-span-2">
            <BotMaintenanceSection />
          </div>
          <PromoSection />
          <PromoScheduleSection />
          <div className="lg:col-span-2">
            <PromoMessagesSection />
          </div>
        </div>
      </div>
    </div>
  )
}


const ROLES = [
  { value: null,      label: 'Всем',             color: 'blue' },
  { value: 'user',    label: 'Пользователям',    color: 'blue' },
  { value: 'operator',label: 'Операторам',       color: 'blue' },
  { value: 'admin',   label: 'Администраторам',  color: 'blue' },
] as const

function BroadcastSection() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [role, setRole] = useState<string | null>(null)
  // Подтверждение прямо на кнопке на несколько секунд после отправки — тост
  // легко пропустить на мобильном (утонул за клавиатурой, свернулся раньше,
  // чем взгляд успел его найти), а без явного «дошло» админ решает, что
  // ничего не отправилось, и жмёт ещё раз почти минуту спустя — так словили
  // задвоенную рассылку рекламы (см. PromoSection). Пока метка активна,
  // кнопка остаётся заблокированной — доп. страховка от рефлекторного тапа.
  const [justSent, setJustSent] = useState(false)

  const sendMut = useMutation({
    mutationFn: () => botApi.broadcastNotification({ title: title.trim(), body: body.trim(), role }),
    onSuccess: (res) => {
      // Рассылка уважает переключатель promotional, поэтому «отправлено всем»
      // было бы неправдой — показываем реальные счётчики из ответа
      toast.success(sendResultText(res))
      setTitle('')
      setBody('')
      setRole(null)
      setJustSent(true)
      window.setTimeout(() => setJustSent(false), 3000)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Ошибка при отправке')),
  })

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sendMut.isPending && !justSent

  return (
    <Card
      icon={<BellIcon className="w-5 h-5 text-white" />}
      iconBg="from-[#4A8FE7] to-[#1B3A72]"
      title="Рассылка push-уведомлений"
      subtitle="Отправка уведомлений в мобильное приложение"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
              Заголовок <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Новое обновление"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400 transition-colors"
            />
          </div>

          {/* На узких экранах селект получателей и кнопка не помещаются в одну строку с лейблом */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Получатели:</span>
            <select
              value={role ?? ''}
              onChange={e => setRole(e.target.value || null)}
              className="flex-1 min-w-0 h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] cursor-pointer transition-colors"
            >
              {ROLES.map(r => (
                <option key={String(r.value)} value={r.value ?? ''}>{r.label}</option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => sendMut.mutate()}
            disabled={!canSend}
            className="w-full bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
          >
            {sendMut.isPending
              ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Отправка...</>
              : justSent
                ? <><CheckIcon className="w-4 h-4 mr-2" />Отправлено</>
                : <><SendIcon className="w-4 h-4 mr-2" />Отправить</>
            }
          </Button>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
            Сообщение <span className="text-red-500">*</span>
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Текст push-уведомления"
            className="w-full flex-1 min-h-32 px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400 resize-none transition-colors"
          />
        </div>
      </div>
    </Card>
  )
}


// broadcast и promo/send отдают одинаковые счётчики. Мягкая проверка на число —
// на случай, если фронт окажется новее бэкенда: лучше общая фраза, чем
// «Отправлено: undefined».
function sendResultText(res: { sent_to?: number; skipped_opted_out?: number } | undefined): string {
  if (typeof res?.sent_to !== 'number') return 'Рассылка отправлена'
  const skipped = res.skipped_opted_out
  return skipped
    ? `Отправлено: ${res.sent_to}, пропущено отписавшихся: ${skipped}`
    : `Отправлено: ${res.sent_to}`
}

// CRUD рекламных заготовок — сами заготовки те же, что использует ручная
// отправка (PromoSection) и расписание (PromoScheduleSection), все три шарят
// один queryKey ['promo-messages'], поэтому после любой правки здесь
// достаточно инвалидировать один ключ, и остальные два блока сами подхватят.
function PromoMessagesSection() {
  const qc = useQueryClient()

  const { data: promos = [], isLoading, isError } = useQuery({
    queryKey: ['promo-messages'],
    queryFn: botApi.getPromoMessages,
  })

  // Список+формы разворачиваются по клику — сама подборка нужна редко
  // (см. правку заготовок), в свёрнутом виде это одна строка, не длинная
  // плашка на весь экран. Тот же приём grid-template-rows, что и в
  // телеметрии на карте регистров (register-definitions-view.tsx).
  const [open, setOpen] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addBody, setAddBody] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const invalidate = () => qc.invalidateQueries({ queryKey: ['promo-messages'] })

  const createMut = useMutation({
    mutationFn: () => botApi.createPromoMessage({ title: addTitle.trim(), body: addBody.trim() }),
    onSuccess: () => {
      invalidate()
      toast.success('Заготовка добавлена')
      setShowAdd(false)
      setAddTitle('')
      setAddBody('')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось создать заготовку')),
  })

  const updateMut = useMutation({
    mutationFn: (id: number) => botApi.updatePromoMessage(id, { title: editTitle.trim(), body: editBody.trim() }),
    onSuccess: () => {
      invalidate()
      toast.success('Заготовка обновлена')
      setEditingId(null)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => botApi.deletePromoMessage(id),
    onSuccess: () => { invalidate(); toast.success('Заготовка удалена') },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось удалить')),
  })

  const startEdit = (p: PromoMessage) => {
    setEditingId(p.id)
    setEditTitle(p.title)
    setEditBody(p.body)
  }

  const handleDelete = (p: PromoMessage) => {
    // Стандартный confirm(), не отдельная модалка — заготовка, использованная
    // в расписании, просто перестанет учитываться при отправке, без ошибок,
    // так что последствия удаления не настолько серьёзны, чтобы городить
    // отдельный узел подтверждения ради одной кнопки (см. похожее решение
    // для удаления адреса целиком в register-map-table.tsx).
    if (window.confirm(`Удалить заготовку «${p.title}»?`)) deleteMut.mutate(p.id)
  }

  const canCreate = addTitle.trim().length > 0 && addTitle.trim().length <= 255 && addBody.trim().length > 0 && addBody.trim().length <= 1000
  const canSaveEdit = editTitle.trim().length > 0 && editTitle.trim().length <= 255 && editBody.trim().length > 0 && editBody.trim().length <= 1000

  return (
    <Card
      icon={<MegaphoneIcon className="w-5 h-5 text-white" />}
      iconBg="from-violet-500 to-violet-700"
      title="Управление заготовками"
      subtitle="Добавление, редактирование и удаление рекламных заготовок"
    >
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between gap-3 -mx-1 -my-1 px-1 py-1 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {isLoading ? 'Загрузка...' : isError ? 'Не удалось загрузить подборку' : `Заготовок: ${promos.length}`}
          </span>
        </div>
      </div>

      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr] mt-3' : 'grid-rows-[0fr]')}>
      <div className="overflow-hidden min-h-0">
      <div className="space-y-3">
        {!showAdd ? (
          <Button variant="outline" onClick={() => setShowAdd(true)} className="cursor-pointer">
            <PlusIcon className="w-4 h-4 mr-1.5" /> Добавить заготовку
          </Button>
        ) : (
          <div className="border border-slate-100 dark:border-slate-700/60 rounded-lg p-3 space-y-2">
            <div>
              <input
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                maxLength={255}
                placeholder="Заголовок"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              />
              <p className="text-[11px] text-slate-400 mt-0.5 text-right">{addTitle.length}/255</p>
            </div>
            <div>
              <textarea
                value={addBody}
                onChange={e => setAddBody(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Текст уведомления"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-0.5 text-right">{addBody.length}/1000</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => { setShowAdd(false); setAddTitle(''); setAddBody('') }}
                disabled={createMut.isPending}
                className="cursor-pointer"
              >
                Отмена
              </Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!canCreate || createMut.isPending}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {createMut.isPending ? 'Создание...' : 'Создать'}
              </Button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-sm text-slate-400">Загрузка...</p>}
        {isError && <p className="text-sm text-slate-400">Не удалось загрузить подборку</p>}
        {!isLoading && !isError && promos.length === 0 && !showAdd && (
          <p className="text-sm text-slate-400">Заготовок пока нет.</p>
        )}

        {promos.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-100 dark:border-slate-700/60 rounded-lg overflow-hidden">
            {promos.map(p => editingId === p.id ? (
              <div key={p.id} className="p-3 space-y-2">
                <div>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    maxLength={255}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5 text-right">{editTitle.length}/255</p>
                </div>
                <div>
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5 text-right">{editBody.length}/1000</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditingId(null)} disabled={updateMut.isPending} className="cursor-pointer">
                    Отмена
                  </Button>
                  <Button
                    onClick={() => updateMut.mutate(p.id)}
                    disabled={!canSaveEdit || updateMut.isPending}
                    className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
                  >
                    {updateMut.isPending ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>
              </div>
            ) : (
              <div key={p.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{p.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{p.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(p)}
                    title="Редактировать"
                    className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deleteMut.isPending}
                    title="Удалить"
                    className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      </div>
    </Card>
  )
}

// Список, создание/редактирование/удаление заготовок — см. PromoMessagesSection
// выше по странице. Здесь только выбор из уже существующих и разовая
// отправка. Без выбранной заготовки сервер берёт случайную.
function PromoSection() {
  const [promoId, setPromoId] = useState<number | null>(null)
  const [role, setRole] = useState<string | null>(null)
  // См. тот же приём и комментарий в BroadcastSection — здесь его особенно не
  // хватало: было зафиксировано реальное задвоение рассылки рекламы (два
  // независимых POST promo/send с разницей 50 секунд, id=735/736), причина —
  // админ не увидел подтверждения отправки и нажал «Разослать» повторно.
  const [justSent, setJustSent] = useState(false)

  const { data: promos = [], isLoading, isError } = useQuery({
    queryKey: ['promo-messages'],
    queryFn: botApi.getPromoMessages,
  })

  const sendMut = useMutation({
    mutationFn: () => botApi.sendPromo(promoId, role),
    onSuccess: (res) => {
      toast.success(sendResultText(res))
      setJustSent(true)
      window.setTimeout(() => setJustSent(false), 3000)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось отправить рекламу')),
  })

  const selected = promos.find(p => p.id === promoId) ?? null

  return (
    <Card
      icon={<MegaphoneIcon className="w-5 h-5 text-white" />}
      iconBg="from-violet-500 to-violet-700"
      title="Рекламные заготовки"
      subtitle="Готовые сообщения из подборки на сервере"
    >
      {isLoading && <p className="text-sm text-slate-400">Загрузка...</p>}
      {isError && <p className="text-sm text-slate-400">Не удалось загрузить подборку</p>}

      {!isLoading && !isError && promos.length === 0 && (
        <p className="text-sm text-slate-400">Подборка пуста — заготовки создаются не отсюда.</p>
      )}

      {promos.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Заготовка</label>
            <select
              value={promoId ?? ''}
              onChange={e => setPromoId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] cursor-pointer transition-colors"
            >
              <option value="">Случайная</option>
              {promos.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Предпросмотр: иначе админ рассылает вслепую по одному заголовку */}
          {selected && (
            <div className="rounded-lg border border-slate-100 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{selected.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">{selected.body}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Получатели:</span>
            <select
              value={role ?? ''}
              onChange={e => setRole(e.target.value || null)}
              className="flex-1 min-w-0 h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] cursor-pointer transition-colors"
            >
              {ROLES.map(r => (
                <option key={String(r.value)} value={r.value ?? ''}>{r.label}</option>
              ))}
            </select>
            <Button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending || justSent}
              className="bg-violet-600 hover:bg-violet-700 cursor-pointer dark:text-white shrink-0"
            >
              {sendMut.isPending
                ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Отправка...</>
                : justSent
                  ? <><CheckIcon className="w-4 h-4 mr-2" />Отправлено</>
                  : <><SendIcon className="w-4 h-4 mr-2" />Разослать</>
              }
            </Button>
          </div>

          <p className="text-xs text-slate-400">
            Уходит только тем, у кого включены рекламные уведомления.
          </p>
        </div>
      )}
    </Card>
  )
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Расписание регулярной рассылки заготовок ботом — в отличие от PromoSection
// выше (разовая ручная отправка), это самостоятельная фоновая задача на
// сервере. send_hour — по UTC (так требует бэкенд), для выбора и подписи
// пересчитываем в локальное время браузера, а на сервер уходит опять UTC.
function PromoScheduleSection() {
  const qc = useQueryClient()

  const { data: promos = [] } = useQuery({
    queryKey: ['promo-messages'],
    queryFn: botApi.getPromoMessages,
  })

  const { data: schedule, isLoading, isError } = useQuery({
    queryKey: ['promo-schedule'],
    queryFn: botApi.getPromoSchedule,
  })

  const [enabled, setEnabled] = useState(false)
  const [intervalDays, setIntervalDays] = useState(1)
  const [sendHourUtc, setSendHourUtc] = useState(10)
  const [messageMode, setMessageMode] = useState<'all' | 'specific'>('all')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Черновик формы подхватывает данные с сервера только когда они пришли —
  // тот же приём, что и в других формах настроек в этом проекте (см.
  // project-page.tsx: warranty-поля из useQuery через useEffect).
  useEffect(() => {
    if (!schedule) return
    setEnabled(schedule.enabled)
    setIntervalDays(schedule.interval_days)
    setSendHourUtc(schedule.send_hour)
    if (schedule.message_ids && schedule.message_ids.length > 0) {
      setMessageMode('specific')
      setSelectedIds(schedule.message_ids)
    } else {
      setMessageMode('all')
      setSelectedIds([])
    }
  }, [schedule])

  const saveMut = useMutation({
    mutationFn: () => botApi.updatePromoSchedule({
      enabled,
      interval_days: intervalDays,
      send_hour: sendHourUtc,
      // null — явный сброс ограничения на "любая заготовка из всех", а не
      // просто отсутствие поля (см. README-backend.md, «Рут admin: bot»).
      message_ids: messageMode === 'all' ? null : selectedIds,
    }),
    onSuccess: (res) => {
      qc.setQueryData(['promo-schedule'], res)
      toast.success('Расписание рассылки сохранено')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить расписание')),
  })

  const toggleMessage = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  // Смещение часового пояса браузера в целых часах — только для подписи к
  // выбору часа (сам send_hour остаётся в UTC).
  const tzOffsetHours = Math.round(-new Date().getTimezoneOffset() / 60)
  const localHour = (h: number) => ((h + tzOffsetHours) % 24 + 24) % 24

  return (
    <Card
      icon={<ClockIcon className="w-5 h-5 text-white" />}
      iconBg="from-amber-500 to-orange-600"
      title="Автоматическая рассылка рекламы"
      subtitle="Регулярная отправка заготовок по расписанию"
    >
      {isLoading && <p className="text-sm text-slate-400">Загрузка...</p>}
      {isError && <p className="text-sm text-slate-400">Не удалось загрузить расписание</p>}

      {schedule && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="cursor-pointer" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Рассылка включена</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Раз в сколько дней</label>
              <input
                type="number"
                min={1}
                max={365}
                value={intervalDays}
                onChange={e => setIntervalDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Час отправки</label>
              <select
                value={sendHourUtc}
                onChange={e => setSendHourUtc(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] cursor-pointer transition-colors"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(localHour(h)).padStart(2, '0')}:00 у вас ({String(h).padStart(2, '0')}:00 UTC)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Какие заготовки рассылать</label>
            <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit mb-2">
              <ModeButton active={messageMode === 'all'} onClick={() => setMessageMode('all')}>Любая из всех</ModeButton>
              <ModeButton active={messageMode === 'specific'} onClick={() => setMessageMode('specific')}>Выбранные</ModeButton>
            </div>
            {messageMode === 'specific' && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-700/60 rounded-lg p-2">
                {promos.length === 0 && <p className="text-xs text-slate-400 px-1 py-1">Подборка пуста</p>}
                {promos.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-1 cursor-pointer select-none">
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleMessage(p.id)} className="cursor-pointer shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{p.title}</span>
                  </label>
                ))}
                {selectedIds.length === 1 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 px-1 pt-1">Выбрана только одна заготовка — она будет уходить каждый раз, без случайности.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-slate-400">
              {schedule.last_sent_at ? <>Последняя рассылка: {fmtDateTime(schedule.last_sent_at)}</> : 'Рассылок ещё не было'}
            </p>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white shrink-0"
            >
              {saveMut.isPending
                ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Сохранение...</>
                : 'Сохранить расписание'
              }
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap',
        active ? 'bg-white dark:bg-slate-700 text-[#1B3A72] dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}

// Итоговая статистика не приходит в HTTP-ответе (реindex считает в фоне,
// prune отдаёт только удалённое) — см. README-backend.md, «Рут admin: bot».
// В штатной работе не нужны: create/update уже индексируют записи сами,
// это инструменты на случай восстановления из бэкапа или ручных правок в БД.
type ReindexScope = 'all' | 'faq' | 'kb_article' | 'document'

const SCOPE_OPTIONS: { value: ReindexScope; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'faq', label: 'Только ЧаВо' },
  { value: 'kb_article', label: 'Только база знаний' },
  { value: 'document', label: 'Документы проекта' },
]

function BotMaintenanceSection() {
  const [force, setForce] = useState(false)
  const [scope, setScope] = useState<ReindexScope>('all')
  const [projectId, setProjectId] = useState<number | null>(null)

  const reindexMut = useMutation({
    mutationFn: () => botApi.reindex({ force, scope, project_id: scope === 'document' ? projectId : null }),
    onSuccess: (res) => toast.success(res.message || 'Индексация запущена в фоне'),
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось запустить индексацию')),
  })

  const pruneMut = useMutation({
    mutationFn: () => botApi.prune(),
    onSuccess: (res) => {
      const { faq, kb_article, document } = res.removed
      const total = faq + kb_article + document
      toast.success(total > 0 ? `Удалено осиротевших записей: ${total}` : 'Осиротевших записей не найдено')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось очистить')),
  })

  return (
    <Card
      icon={<DatabaseIcon className="w-5 h-5 text-white" />}
      iconBg="from-slate-500 to-slate-700"
      title="Обслуживание базы бота"
      subtitle="Восстановление индекса после бэкапа или ручных правок в БД"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Переиндексация</p>
              <p className="text-xs text-slate-400 mt-0.5">ЧаВо, база знаний, документы ШУ</p>
            </div>
            <Button
              onClick={() => reindexMut.mutate()}
              disabled={reindexMut.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white shrink-0"
            >
              {reindexMut.isPending
                ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Запуск...</>
                : 'Переиндексировать'
              }
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {SCOPE_OPTIONS.map(o => (
              <PillButton
                key={o.value}
                active={scope === o.value}
                onClick={() => { setScope(o.value); if (o.value !== 'document') setProjectId(null) }}
              >
                {o.label}
              </PillButton>
            ))}
          </div>

          {scope === 'document' && (
            <div className="mt-2.5">
              <ProjectCombobox value={projectId} onChange={setProjectId} placeholder="Все проекты (необязательно)" />
              <p className="text-xs text-slate-400 mt-1.5">
                Переиндексирует документы этого проекта, его дочерних проектов и всех ШУ внутри них —
                ровно то, что видит бот в чате проекта. Без выбора — документы всех проектов.
              </p>
            </div>
          )}

          <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} className="cursor-pointer" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Полная переиндексация всего (медленно) — иначе только записи без эмбеддингов
            </span>
          </label>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Осиротевшие эмбеддинги</p>
              <p className="text-xs text-slate-400 mt-0.5">Чистит записи, чей источник уже удалён</p>
            </div>
            <Button
              variant="ghost"
              onClick={() => pruneMut.mutate()}
              disabled={pruneMut.isPending}
              className="cursor-pointer shrink-0"
            >
              {pruneMut.isPending
                ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Очистка...</>
                : 'Очистить'
              }
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function Card({ icon, iconBg, title, subtitle, children }: {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
      <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className={cn('w-10 h-10 rounded-xl bg-linear-to-br flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="px-4 sm:px-5 py-5">
        {children}
      </div>
    </div>
  )
}

function BellIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
}
function SendIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
function MegaphoneIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>
}
function DatabaseIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 3.375c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
}
function ClockIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function PencilIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}