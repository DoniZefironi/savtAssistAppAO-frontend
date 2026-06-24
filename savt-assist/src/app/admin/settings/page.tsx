'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { botApi } from '@/lib/api/bot'
import type { ReindexResult } from '@/lib/api/bot'
import { Button } from '@/components/ui/button'

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="px-6 pt-6 pb-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Настройки</h1>
        <p className="text-sm text-slate-400 mt-0.5">Управление системой и инструменты администратора</p>
      </div>

      <div className="px-6 py-6 grid grid-cols-2 gap-4 items-start">
        <BroadcastSection />
        <BotSection />
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
    onSuccess: () => {
      toast.success('Уведомление отправлено')
      setTitle('')
      setBody('')
      setRole(null)
    },
    onError: () => toast.error('Ошибка при отправке'),
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

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Получатели:</span>
          <select
            value={role ?? ''}
            onChange={e => setRole(e.target.value || null)}
            className="flex-1 h-9 px-3 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] cursor-pointer transition-colors"
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


function BotSection() {
  const [result, setResult] = useState<ReindexResult | null>(null)
  const [lastForce, setLastForce] = useState(false)

  const reindexMut = useMutation({
    mutationFn: (force: boolean) => botApi.reindex(force),
    onSuccess: (data, force) => {
      setResult(data)
      setLastForce(force)
      toast.success(force ? 'Полная переиндексация завершена' : 'Индексация завершена')
    },
    onError: () => toast.error('Ошибка при индексации'),
  })

  const run = (force: boolean) => {
    setResult(null)
    setLastForce(force)
    reindexMut.mutate(force)
  }

  const isRunningNew   = reindexMut.isPending && !lastForce
  const isRunningForce = reindexMut.isPending && lastForce

  return (
    <Card
      icon={<BotIcon className="w-5 h-5 text-white" />}
      iconBg="from-violet-500 to-violet-700"
      title="Бот Ася"
      subtitle="RAG-ассистент на базе YandexGPT"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Бот обрабатывает FAQ, статьи базы знаний и документы ШУ. Индексация происходит автоматически при создании и изменении записей — ручной запуск нужен только при массовом импорте.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ActionCard
            icon={<ZapIcon className="w-4 h-4" />}
            iconCls="text-[#4A8FE7]"
            title="Индексировать новое"
            description="Только записи без эмбеддингов. Быстро."
            action={
              <Button
                onClick={() => run(false)}
                disabled={reindexMut.isPending}
                className="w-full bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {isRunningNew
                  ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Индексация...</>
                  : <><ZapIcon className="w-4 h-4 mr-2" />Запустить</>
                }
              </Button>
            }
          />

          <ActionCard
            icon={<RefreshIcon className="w-4 h-4" />}
            iconCls="text-amber-500"
            title="Полная переиндексация"
            description="Все записи заново. Медленно."
            warning
            action={
              <Button
                onClick={() => run(true)}
                disabled={reindexMut.isPending}
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20 cursor-pointer"
              >
                {isRunningForce
                  ? <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Переиндексация...</>
                  : <><RefreshIcon className="w-4 h-4 mr-2" />Запустить</>
                }
              </Button>
            }
          />
        </div>

        {result && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
            <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="text-xs text-green-700 dark:text-green-300">
              <span className="font-medium">{lastForce ? 'Полная переиндексация' : 'Индексация'} завершена.</span>
              {' '}FAQ: <b>{result.indexed.faq}</b>, KB: <b>{result.indexed.kb_article}</b>, документы: <b>{result.indexed.document}</b>
              {result.indexed.skipped > 0 && <>, пропущено: <b>{result.indexed.skipped}</b></>}.
            </div>
          </div>
        )}
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
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className={cn('w-10 h-10 rounded-xl bg-linear-to-br flex items-center justify-center shrink-0', iconBg)}>
          {icon}
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="px-5 py-5">
        {children}
      </div>
    </div>
  )
}

function ActionCard({ icon, iconCls, title, description, warning, action }: {
  icon: React.ReactNode
  iconCls: string
  title: string
  description: string
  warning?: boolean
  action: React.ReactNode
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3',
      warning
        ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10'
        : 'border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50'
    )}>
      <div className="flex items-center gap-2">
        <span className={iconCls}>{icon}</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">{description}</p>
      {action}
    </div>
  )
}

function BellIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
}
function SendIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
}
function BotIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>
}
function RefreshIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
}
function ZapIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
}
function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
