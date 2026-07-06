'use client'

import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, FileText, MessageCircle, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chatsApi } from '@/lib/api/chats'
import type { MessageSearchResult } from '@/lib/api/chats'
import { useChatNavStore } from '@/lib/store/chat-nav'
import type { Chat } from '@/types'

interface Props {
  chats: Chat[]
  selectedId: number | null
  onSelect: (chat: Chat) => void
  onSelectChatId: (id: number) => void
  loading: boolean
  compact?: boolean
  searchValue: string
  onSearchChange: (v: string) => void
  onCollapse?: () => void
}

export function ChatListPanel({ chats, selectedId, onSelect, onSelectChatId, loading, compact, searchValue, onSearchChange, onCollapse }: Props) {
  const setPending = useChatNavStore((s) => s.setPending)
  const sorted = [...chats].sort((a, b) => {
    if (a.operator_requested && !b.operator_requested) return -1
    if (!a.operator_requested && b.operator_requested) return 1
    return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
  })

  const trimmed = searchValue.trim()

  const { data: msgData, isFetching: msgLoading } = useQuery({
    queryKey: ['global-search', trimmed],
    queryFn: () => chatsApi.searchAllMessages(trimmed, 1, 50),
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  })
  const msgResults = useMemo(() => {
    const seen = new Set<number>()
    return (msgData?.items ?? [] as MessageSearchResult[]).filter((item: MessageSearchResult) => {
      if (seen.has(item.chat_id)) return false
      seen.add(item.chat_id)
      return true
    })
  }, [msgData?.items])

  if (compact) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto overflow-x-hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex justify-center py-2">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse" />
              </div>
            ))
          : sorted.map(chat => (
              <CompactChatRow
                key={chat.id}
                chat={chat}
                selected={chat.id === selectedId}
                onSelect={() => onSelect(chat)}
              />
            ))
        }
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <div className="border-b border-slate-100 dark:border-slate-700/60">
        <div className="px-3 py-3 flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Поиск"
              className="w-full text-sm bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors"
            />
          </div>
          {onCollapse && (
            <button
              onClick={onCollapse}
              title="Свернуть панель"
              className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-px pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && trimmed.length >= 2 ? (
          <>
            {/* Chats section */}
            {sorted.length > 0 && (
              <>
                <div className="px-3 py-1.5 mt-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Чаты</span>
                </div>
                {sorted.map((chat) => (
                  <ChatRow key={chat.id} chat={chat} selected={chat.id === selectedId} onSelect={() => onSelect(chat)} />
                ))}
              </>
            )}

            {/* Messages section */}
            <div className="px-3 py-1.5 mt-1">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Сообщения</span>
            </div>
            {msgLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#1B3A72] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : msgResults.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-400">Сообщения не найдены</div>
            ) : (
              msgResults.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setPending(item.chat_id, item.id); onSearchChange(''); onSelectChatId(item.chat_id) }}
                  className="w-full text-left flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-800"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1B3A72]/10 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5 text-[#1B3A72] dark:text-blue-400">
                    {item.chat_type === 'cabinet' ? <Package className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-[#1B3A72] dark:text-blue-400 truncate">
                        {item.chat_type === 'cabinet' && item.cabinet_object_number
                          ? `ШУ ${item.cabinet_object_number}`
                          : item.sender_name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{formatTime(item.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 truncate">{item.sender_name}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">{item.text}</p>
                  </div>
                </button>
              ))
            )}

            {!sorted.length && !msgLoading && msgResults.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm gap-2">
                <Search className="w-7 h-7 opacity-50" />
                Ничего не найдено
              </div>
            )}
          </>
        ) : !loading && (
          <>
            {sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm gap-2">
                <MessageCircle className="w-7 h-7 opacity-50" />
                Нет чатов
              </div>
            )}
            {sorted.map((chat) => (
              <ChatRow key={chat.id} chat={chat} selected={chat.id === selectedId} onSelect={() => onSelect(chat)} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function CompactChatRow({ chat, selected, onSelect }: { chat: Chat; selected: boolean; onSelect: () => void }) {
  const hasUnread = chat.unread_count > 0
  const isWaiting = chat.operator_requested
  const bg = selected ? 'ring-2 ring-[#1B3A72] ring-offset-1' : ''
  const avatarBg = chatColor(chat)

  return (
    <button
      onClick={onSelect}
      title={chatDisplayName(chat)}
      className={cn(
        'relative w-full flex justify-center py-1.5 transition-colors cursor-pointer',
        selected
          ? 'bg-[#1B3A72]/10 dark:bg-[#1B3A72]/20'
          : isWaiting
            ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-base font-semibold text-white',
        avatarBg, bg
      )}>
        {chat.chat_type === 'cabinet' ? <Package className="w-4 h-4" /> : chat.chat_type === 'notes' ? <FileText className="w-4 h-4" /> : chatInitials(chat)}
      </div>

      {hasUnread && (
        <span className="absolute top-1 right-1.5 min-w-4 h-4 bg-[#1B3A72] text-white text-[9px] rounded-full flex items-center justify-center px-0.5 font-bold leading-none">
          {chat.unread_count > 9 ? '9+' : chat.unread_count}
        </span>
      )}

      {isWaiting && !hasUnread && (
        <span className="absolute top-1.5 right-2 w-2 h-2 bg-amber-500 rounded-full" />
      )}
    </button>
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
        'w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors relative cursor-pointer',
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
          <span className={cn('text-sm font-semibold truncate', selected ? 'text-white' : 'text-slate-800 dark:text-slate-100')}>
            {name}
          </span>
          {chat.last_message_at && (
            <span className={cn('text-xs shrink-0', selected ? 'text-white/70' : hasUnread ? 'text-[#1B3A72] dark:text-blue-400' : 'text-slate-400')}>
              {formatTime(chat.last_message_at)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn('text-xs truncate', selected ? 'text-white/70' : 'text-slate-500 dark:text-slate-400')}>
            {chat.last_message_text ?? ''}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {isWaiting && !selected && <span className="w-2 h-2 bg-amber-500 rounded-full" />}
            {hasUnread && (
              <span className={cn(
                'min-w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center px-1.5',
                selected ? 'bg-white text-[#1B3A72]' : 'bg-[#1B3A72] text-white'
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
  const bg = selected ? 'bg-white/20' : chatColor(chat)
  return (
    <div className={cn('w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-lg font-semibold', bg, !selected && 'text-white')}>
      {chat.chat_type === 'cabinet' ? <Package className="w-5 h-5" /> : chat.chat_type === 'notes' ? <FileText className="w-5 h-5" /> : chatInitials(chat)}
    </div>
  )
}

export function chatDisplayName(chat: Chat): string {
  const user = chat.user_name ?? null
  if (chat.chat_type === 'cabinet') {
    const cabinet = chat.cabinet_name ?? `ШУ #${chat.id}`
    return chat.user_name ? `${cabinet} — ${chat.user_name}` : cabinet
  }
  if (chat.chat_type === 'notes') return user ? `Заметки — ${user}` : `Заметки #${chat.id}`
  if (chat.chat_type === 'support') return user ? `Поддержка — ${user}` : `Поддержка #${chat.id}`
  return `Чат #${chat.id}`
}

function chatInitials(chat: Chat): ReactNode {
  const name = chat.user_name
  if (!name) return chat.chat_type === 'support' ? <MessageCircle className="w-4 h-4" /> : '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function chatColor(chat: Chat): string {
  const colors = ['bg-violet-500', 'bg-rose-500', 'bg-sky-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500']
  return chat.chat_type === 'cabinet' ? 'bg-[#1B3A72]' : colors[chat.id % colors.length]
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'вчера'
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit' })
}
