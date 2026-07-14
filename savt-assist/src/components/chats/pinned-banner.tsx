'use client'

import { Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'

interface Props {
  activePin: ChatMessage
  pinnedMessages: ChatMessage[]
  activePinIdx: number
  onAdvance: () => void
  onJumpToMessage: (id: number) => void
  onUnpin: (id: number) => void
}

export function PinnedBanner({ activePin, pinnedMessages, activePinIdx, onAdvance, onJumpToMessage, onUnpin }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      onClick={() => { onJumpToMessage(activePin.id); if (pinnedMessages.length > 1) onAdvance() }}>
      {/* индикатор позиции среди нескольких закрепов */}
      {pinnedMessages.length > 1 ? (
        <div className="flex flex-col gap-0.5 shrink-0 self-stretch py-0.5">
          {pinnedMessages.map((m, i) => (
            <div key={m.id} className={cn('flex-1 w-0.5 rounded-full', i === activePinIdx % pinnedMessages.length ? 'bg-[#1B3A72] dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-600')} />
          ))}
        </div>
      ) : (
        <div className="w-0.5 h-7 bg-[#1B3A72] dark:bg-blue-400 rounded-full shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-[#1B3A72] dark:text-blue-400">
          {pinnedMessages.length > 1 ? `Закреплённое сообщение ${activePinIdx % pinnedMessages.length + 1}/${pinnedMessages.length}` : 'Закреплённое сообщение'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
          {!activePin.text && <Paperclip className="w-3 h-3 shrink-0" />}
          {activePin.text || 'Вложение'}
        </p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onUnpin(activePin.id) }}
        title="Открепить"
        className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
