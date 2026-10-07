'use client'

import { useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_REASON = 1000

// Подтверждение отзыва доступа с обязательной причиной (1–1000 символов, нужна
// только для аудита — пользователю не показывается). Общее для «Убрать из
// проекта» и «Отвязать ШУ». Саму мутацию и разбор ошибок делает родитель:
// error — текст с сервера (например, 409), показывается прямо в окне, extra —
// подсказка под ним.
export function RevokeAccessDialog({ title, warning, confirmLabel, pending, error, extra, onConfirm, onClose }: {
  title: string
  warning: ReactNode
  confirmLabel: string
  pending: boolean
  error?: string | null
  extra?: ReactNode
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const trimmed = reason.trim()
  const invalid = trimmed.length === 0 || trimmed.length > MAX_REASON
  const showInvalid = touched && invalid

  const submit = () => {
    setTouched(true)
    if (invalid) return
    onConfirm(trimmed)
  }

  return (
    <AppModal open onClose={onClose} className="sm:max-w-md">
      <div className="min-w-0">
        <div className="flex items-center gap-3 px-5 pr-14 py-4 text-white bg-red-500">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h3 className="text-base font-semibold wrap-break-word">{title}</h3>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div className="text-sm text-slate-600 dark:text-slate-300 wrap-break-word">{warning}</div>

          <div>
            <label htmlFor="revoke-reason" className="text-xs font-medium text-slate-500 block mb-1">
              Причина <span className="text-red-500">*</span>
            </label>
            <textarea
              id="revoke-reason"
              value={reason}
              onChange={e => { setReason(e.target.value); setTouched(true) }}
              placeholder="Для журнала аудита, пользователь её не увидит"
              rows={3}
              maxLength={MAX_REASON}
              autoFocus
              className={cn(
                'w-full px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none',
                showInvalid
                  ? 'border-red-400 focus:border-red-500 dark:border-red-500'
                  : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
              )}
            />
            {showInvalid && <p className="text-xs text-red-500 mt-1">Укажите причину</p>}
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 wrap-break-word">{error}</p>
          )}
          {extra}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4">
          <Button variant="ghost" onClick={onClose} disabled={pending} className="cursor-pointer">Отмена</Button>
          <Button onClick={submit} disabled={pending} className="bg-red-500 hover:bg-red-600 text-white cursor-pointer">
            {pending ? 'Выполняется...' : confirmLabel}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}
