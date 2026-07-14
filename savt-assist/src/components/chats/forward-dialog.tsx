'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Package, FileText, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chatsApi } from '@/lib/api/chats'
import { chatDisplayName } from './chat-list-panel'
import type { Chat, ChatMessage } from '@/types'

export function ForwardDialog({ messages, currentChatId, onClose }: { messages: ChatMessage[]; currentChatId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [sending, setSending] = useState(false)
  const [showSender, setShowSender] = useState(true)
  // Ключ запроса — ['operator-chats', chatSearch] (с параметром поиска), поэтому берём
  // данные из всех совпадающих запросов через getQueriesData, а не точечным getQueryData.
  const chats = (() => {
    const seen = new Set<number>()
    const list: Chat[] = []
    for (const [, data] of qc.getQueriesData<Chat[]>({ queryKey: ['operator-chats'] })) {
      for (const c of data ?? []) {
        if (c.id === currentChatId || seen.has(c.id)) continue
        seen.add(c.id)
        list.push(c)
      }
    }
    return list
  })()

  const forward = async (chatId: number) => {
    setSending(true)
    try {
      let lastMsg: ChatMessage | null = null
      let prevSender: string | null = null
      // последовательно, чтобы сохранить порядок сообщений на бэке
      for (const m of messages) {
        // подпись отправителя показываем только когда он меняется (как в Telegram)
        const header = showSender && m.sender_name !== prevSender ? `↪ ${m.sender_name}` : ''
        const body = m.text ?? ''
        const text = header && body ? `${header}\n${body}` : (header || body)
        lastMsg = await chatsApi.sendMessage(chatId, text, m.attachments?.length ? m.attachments : undefined)
        prevSender = m.sender_name
      }
      if (lastMsg) {
        const last = lastMsg
        qc.setQueriesData<Chat[]>({ queryKey: ['operator-chats'] }, (prev) =>
          prev?.map((c) => c.id === chatId ? { ...c, last_message_text: last.text || last.attachments?.[0]?.file_name || c.last_message_text, last_message_at: last.created_at } : c) ?? prev
        )
      }
      toast.success(messages.length > 1 ? `Переслано сообщений: ${messages.length}` : 'Сообщение переслано')
      onClose()
    } catch {
      toast.error('Не удалось переслать')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 mb-4 sm:mb-0 max-h-[60vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            {messages.length > 1 ? `Переслать (${messages.length})` : 'Переслать в чат'}
          </p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowSender(v => !v)}
          className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          <span className="text-sm text-slate-700 dark:text-slate-200">Показывать отправителя</span>
          <span className={cn('relative w-9 h-5 rounded-full transition-colors shrink-0', showSender ? 'bg-[#1B3A72]' : 'bg-slate-300 dark:bg-slate-600')}>
            <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', showSender && 'translate-x-4')} />
          </span>
        </button>
        <div className="overflow-y-auto flex-1 py-1">
          {chats.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Нет других чатов</p>}
          {chats.map((c) => {
            const ItemIcon = c.chat_type === 'cabinet' ? Package : c.chat_type === 'notes' ? FileText : MessageCircle
            return (
            <button key={c.id} disabled={sending} onClick={() => forward(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50 cursor-pointer">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0', c.chat_type === 'cabinet' ? 'bg-[#1B3A72] text-white' : 'bg-slate-400 text-white')}>
                <ItemIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{chatDisplayName(c)}</p>
                {c.last_message_text && <p className="text-xs text-slate-400 truncate">{c.last_message_text}</p>}
              </div>
            </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
