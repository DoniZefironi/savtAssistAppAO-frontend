'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Chat } from '@/types'

interface Props {
  chats: Chat[]
  selectedId: number | null
  onSelect: (chat: Chat) => void
  loading: boolean
  onCollapse?: () => void
}

export function ChatListPanel({ chats, selectedId, onSelect, loading, onCollapse }: Props) {
  const [search, setSearch] = useState('')

  const filtered = chats.filter((c) =>
    chatDisplayName(c).toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (a.operator_requested && !b.operator_requested) return -1
    if (!a.operator_requested && b.operator_requested) return 1
    return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
  })

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60">
      <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className="w-full text-sm bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors"
          />
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Свернуть панель"
            className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-px pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm gap-2">
            <span className="text-3xl">💬</span>
            {search ? 'Ничего не найдено' : 'Нет чатов'}
          </div>
        )}

        {!loading && sorted.map((chat) => (
          <ChatRow
            key={chat.id}
            chat={chat}
            selected={chat.id === selectedId}
            onSelect={() => onSelect(chat)}
          />
        ))}
      </div>
    </div>
  )
}

function ChatRow({ chat, selected, onSelect }: { chat: Chat; selected: boolean; onSelect: () => void }) {
  const name = chatDisplayName(chat)
  const hasUnread = chat.unread_count > 0
  const isWaiting = chat.operator_requested

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors relative',
        selected
          ? 'bg-[#1B3A72] text-white'
          : isWaiting
            ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
      )}
    >
      <ChatAvatar chat={chat} selected={selected} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sm font-semibold truncate',
            selected ? 'text-white' : 'text-slate-800 dark:text-slate-100'
          )}>
            {name}
          </span>
          {chat.last_message_at && (
            <span className={cn(
              'text-xs shrink-0',
              selected ? 'text-white/70' : hasUnread ? 'text-[#1B3A72] dark:text-blue-400' : 'text-slate-400'
            )}>
              {formatTime(chat.last_message_at)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            'text-xs truncate',
            selected ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'
          )}>
            {chat.last_message_text ?? ''}
          </p>

          <div className="flex items-center gap-1 shrink-0">
            {isWaiting && !selected && (
              <span className="w-2 h-2 bg-amber-500 rounded-full" />
            )}
            {hasUnread && (
              <span className={cn(
                'min-w-[20px] h-5 rounded-full text-xs font-bold flex items-center justify-center px-1.5',
                selected
                  ? 'bg-white text-[#1B3A72]'
                  : 'bg-[#1B3A72] text-white'
              )}>
                {chat.unread_count > 99 ? '99+' : chat.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function ChatAvatar({ chat, selected }: { chat: Chat; selected: boolean }) {
  const initials = chatInitials(chat)
  const bg = selected ? 'bg-white/20' : chatColor(chat)

  return (
    <div className={cn(
      'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-semibold',
      bg,
      !selected && 'text-white'
    )}>
      {chat.chat_type === 'cabinet'
        ? <span>📦</span>
        : chat.chat_type === 'notes'
          ? <span>📝</span>
          : <span>{initials}</span>
      }
    </div>
  )
}

export function chatDisplayName(chat: Chat): string {
  const user = chat.user_name ?? null
  if (chat.chat_type === 'cabinet') return chat.cabinet_name ?? `ШУ #${chat.id}`
  if (chat.chat_type === 'notes') return user ? `Заметки — ${user}` : `Заметки #${chat.id}`
  if (chat.chat_type === 'support') return user ? `Поддержка — ${user}` : `Поддержка #${chat.id}`
  return `Чат #${chat.id}`
}

function chatInitials(chat: Chat): string {
  const name = chat.user_name
  if (!name) return chat.chat_type === 'support' ? '💬' : '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function chatColor(chat: Chat): string {
  const colors = ['bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500']
  return chat.chat_type === 'cabinet' ? 'bg-[#1B3A72]' : colors[chat.id % colors.length]
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'вчера'
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}
