'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChatListPanel } from './chat-list-panel'
import { ChatConversation } from './chat-conversation'
import { chatsApi } from '@/lib/api/chats'
import { cabinetsApi } from '@/lib/api/cabinets'
import type { Chat, ChatMessage } from '@/types'

export function ChatsPage() {
  const qc = useQueryClient()
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [showConversation, setShowConversation] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const { data: rawChats = [], isLoading } = useQuery({
    queryKey: ['operator-chats'],
    queryFn: chatsApi.getChats,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })

  const { data: cabinetsData } = useQuery({
    queryKey: ['cabinets-for-chat'],
    queryFn: () => cabinetsApi.getAll({ size: 100 }),
    staleTime: 60_000,
  })

  const cabinetNameMap = useMemo(() => {
    const map = new Map<number, string>()
    cabinetsData?.items.forEach((c) => map.set(c.id, c.admin_internal_name ?? c.object_number))
    return map
  }, [cabinetsData])

  const chats = useMemo<Chat[]>(() => {
    return rawChats
      .filter((c) => c.chat_type !== 'notes')
      .map((chat) => {
        const betterCabinetName = chat.cabinet_id
          ? cabinetNameMap.get(chat.cabinet_id) ?? chat.cabinet_name
          : chat.cabinet_name

        const cachedMessages = qc.getQueryData<ChatMessage[]>(['messages', chat.id])
        const cachedLastText = cachedMessages?.[0]?.text ?? cachedMessages?.[0]?.attachments?.[0]?.file_name

        return {
          ...chat,
          cabinet_name: betterCabinetName,
          last_message_text: chat.last_message_text ?? cachedLastText ?? null,
          user_name:
            chat.user_name ?? chat.user_full_name ??
            getUserNameFromCache(qc, chat.id),
        }
      })
  }, [rawChats, cabinetNameMap, qc])

  const enrichedSelected = selectedChat
    ? (chats.find((c) => c.id === selectedChat.id) ?? selectedChat)
    : null

  const handleSelect = useCallback((chat: Chat) => {
    setSelectedChat(chat)
    setShowConversation(true)
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className={`flex-shrink-0 h-full overflow-hidden transition-[width] duration-200 ${
        showConversation
          ? `hidden ${sidebarOpen ? 'md:flex md:flex-col md:w-72' : 'md:flex md:flex-col md:w-0'}`
          : `flex flex-col ${sidebarOpen ? 'w-full md:w-72' : 'w-full md:w-0'}`
      }`}>
        <div className="w-72 h-full flex flex-col">
          <ChatListPanel
            chats={chats}
            selectedId={enrichedSelected?.id ?? null}
            onSelect={handleSelect}
            loading={isLoading}
            onCollapse={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {!sidebarOpen && (
        <div className="hidden md:flex flex-col items-center flex-shrink-0 w-10 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/60">
          <button
            onClick={() => setSidebarOpen(true)}
            title="Открыть список чатов"
            className="mt-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}

      <div className={`flex-1 h-full ${showConversation ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
        {enrichedSelected ? (
          <ChatConversation
            key={enrichedSelected.id}
            chat={enrichedSelected}
            onBack={() => setShowConversation(false)}
            onMessagesLoaded={() => {
              qc.invalidateQueries({ queryKey: ['operator-chats'], refetchType: 'none' })
            }}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}

function getUserNameFromCache(qc: ReturnType<typeof useQueryClient>, chatId: number): string | null {
  const msgs = qc.getQueryData<ChatMessage[]>(['messages', chatId])
  if (!msgs) return null
  const userMsg = msgs.find((m) => m.sender_name && m.sender_name !== 'Bot' && m.sender_name !== 'bot')
  return userMsg?.sender_name ?? null
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 bg-[linear-gradient(160deg,#f5f7fa_0%,#eaeff8_100%)] dark:bg-slate-800">
      <span className="text-5xl">💬</span>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Выберите чат</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-40">
        Выберите чат из списка слева
      </p>
    </div>
  )
}
