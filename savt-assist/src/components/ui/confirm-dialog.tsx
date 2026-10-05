'use client'

import { AlertTriangle, HelpCircle } from 'lucide-react'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useConfirmStore } from '@/lib/store/confirm'

// Окно подтверждения для confirmDialog() (lib/store/confirm.ts). Закрытие
// крестиком, Esc или кликом мимо — это «отмена», промис резолвится в false.
export function ConfirmHost() {
  const request = useConfirmStore((s) => s.request)
  const settle = useConfirmStore((s) => s.settle)
  if (!request) return null

  const { title, message, confirmLabel, cancelLabel, danger } = request
  const Icon = danger ? AlertTriangle : HelpCircle

  return (
    <AppModal open onClose={() => settle(false)} className="sm:max-w-md">
      <div className="min-w-0">
        <div className={cn('flex items-center gap-3 px-5 pr-14 py-4 text-white', danger ? 'bg-red-500' : 'bg-[#1B3A72]')}>
          <Icon className="w-5 h-5 shrink-0" />
          <h3 className="text-base font-semibold wrap-break-word">{title}</h3>
        </div>
        {message && (
          <p className="px-5 pt-4 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line wrap-break-word">{message}</p>
        )}
        <div className="flex justify-end gap-2 px-5 py-4">
          <Button variant="ghost" onClick={() => settle(false)} className="cursor-pointer">
            {cancelLabel ?? 'Отмена'}
          </Button>
          <Button
            autoFocus
            onClick={() => settle(true)}
            className={cn('cursor-pointer text-white', danger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1B3A72] hover:bg-[#1B3A72]/90')}
          >
            {confirmLabel ?? 'Подтвердить'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}
