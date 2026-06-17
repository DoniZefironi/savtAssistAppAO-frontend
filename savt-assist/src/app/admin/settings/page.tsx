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
      <div className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Настройки</h1>
        <p className="text-sm text-slate-400 mt-0.5">Управление системой и инструменты администратора</p>
      </div>

      <div className="px-6 py-6 space-y-5 max-w-3xl">
        <BroadcastSection />
        <BotSection />
      </div>
    </div>
  )
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: null, label: 'Всем' },
  { value: 'user', label: 'Пользователям' },
  { value: 'operator', label: 'Операторам' },
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
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#4A8FE7] to-[#1B3A72] flex items-center justify-center shrink-0">
          <BellIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Рассылка push-уведомлений</p>
          <p className="text-xs text-slate-400 mt-0.5">Отправка уведомлений в мобильное приложение</p>
        </div>
      </div>

      {/* Form */}
      <div className="px-5 pt-4 pb-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Заголовок <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Например: Новое обновление"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Текст <span className="text-red-500">*</span>
            </label>
            <input
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Краткое описание"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Получатели:</span>
            <div className="flex gap-1.5">
              {ROLES.map(r => (
                <button
                  key={String(r.value)}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                    role === r.value
                      ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-[#1B3A72] hover:text-[#1B3A72]'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => sendMut.mutate()}
            disabled={!canSend}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
          >
            {sendMut.isPending ? (
              <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Отправка...</>
            ) : (
              <><SendIcon className="w-4 h-4 mr-2" />Отправить</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Bot ──────────────────────────────────────────────────────────────────────

function BotSection() {
  const [result, setResult] = useState<ReindexResult | null>(null)

  const reindexMut = useMutation({
    mutationFn: botApi.reindex,
    onSuccess: (data) => {
      setResult(data)
      toast.success('Реиндексация завершена')
    },
    onError: () => toast.error('Ошибка при реиндексации'),
  })

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-700/60">
        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#4A8FE7] to-[#1B3A72] flex items-center justify-center shrink-0">
          <BotIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Бот Ася</p>
          <p className="text-xs text-slate-400 mt-0.5">RAG-ассистент на базе YandexGPT</p>
        </div>
      </div>

      {/* Row */}
      <div className="px-5 py-4 flex items-center justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Реиндексация базы знаний</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Бот заново обработает FAQ, статьи KB и документы ШУ. Запускайте после массового обновления данных.
          </p>
          {result && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600 dark:text-green-400">
              <CheckIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Проиндексировано — FAQ: {result.indexed.faq}, KB: {result.indexed.kb_article}, документы: {result.indexed.document}</span>
            </div>
          )}
        </div>

        <Button
          onClick={() => { setResult(null); reindexMut.mutate() }}
          disabled={reindexMut.isPending}
          className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer shrink-0"
        >
          {reindexMut.isPending ? (
            <><SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />Индексация...</>
          ) : (
            <><RefreshIcon className="w-4 h-4 mr-2" />Реиндексировать</>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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
function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
