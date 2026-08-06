'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { botApi } from '@/lib/api/bot'
import { apiErrorMessage } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth'

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
        <div className="max-w-xl mx-auto space-y-4">
          <BroadcastSection />
          <PromoSection />
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

  const sendMut = useMutation({
    mutationFn: () => botApi.broadcastNotification({ title: title.trim(), body: body.trim(), role }),
    onSuccess: (res) => {
      // Рассылка уважает переключатель promotional, поэтому «отправлено всем»
      // было бы неправдой — показываем реальные счётчики из ответа
      toast.success(sendResultText(res))
      setTitle('')
      setBody('')
      setRole(null)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Ошибка при отправке')),
  })

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sendMut.isPending

  return (
    <Card
      icon={<BellIcon className="w-5 h-5 text-white" />}
      iconBg="from-[#4A8FE7] to-[#1B3A72]"
      title="Рассылка push-уведомлений"
      subtitle="Отправка уведомлений в мобильное приложение"
    >
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

        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">
            Сообщение <span className="text-red-500">*</span>
          </label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Текст push-уведомления"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400 resize-none transition-colors"
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
          <Button
            onClick={() => sendMut.mutate()}
            disabled={!canSend}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white shrink-0"
          >
            {sendMut.isPending
              ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Отправка...</>
              : <><SendIcon className="w-4 h-4 mr-2" />Отправить</>
            }
          </Button>
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

// Готовые рекламные заготовки лежат файлом на сервере и правятся руками —
// отсюда их можно только просмотреть и разослать. Без выбранной заготовки
// сервер берёт случайную.
function PromoSection() {
  const [promoId, setPromoId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)

  const { data: promos = [], isLoading, isError } = useQuery({
    queryKey: ['promo-messages'],
    queryFn: botApi.getPromoMessages,
  })

  const sendMut = useMutation({
    mutationFn: () => botApi.sendPromo(promoId, role),
    onSuccess: (res) => toast.success(sendResultText(res)),
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
        <p className="text-sm text-slate-400">
          Подборка пуста. Заготовки правятся файлом на сервере — см. <code className="text-xs">PROMO_MESSAGES_FILE</code>.
        </p>
      )}

      {promos.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1.5">Заготовка</label>
            <select
              value={promoId ?? ''}
              onChange={e => setPromoId(e.target.value || null)}
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
              disabled={sendMut.isPending}
              className="bg-violet-600 hover:bg-violet-700 cursor-pointer dark:text-white shrink-0"
            >
              {sendMut.isPending
                ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Отправка...</>
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
function MegaphoneIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" /></svg>
}
function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
