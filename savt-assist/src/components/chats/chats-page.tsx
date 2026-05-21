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

  const { data: rawChats = [], isLoading } = useQuery({
    queryKey: ['operator-chats'],
    queryFn: chatsApi.getChats,
    refetchInterval: 10_000,
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
      // Скрываем чужие заметки — notes чаты не показываем в операторской панели
      .filter((c) => c.chat_type !== 'notes')
      .map((chat) => {
        // Обогащаем имя ШУ из кэша кабинетов
        const betterCabinetName = chat.cabinet_id
          ? cabinetNameMap.get(chat.cabinet_id) ?? chat.cabinet_name
          : chat.cabinet_name

        // Обогащаем last_message_text из кэша сообщений
        const cachedMessages = qc.getQueryData<ChatMessage[]>(['messages', chat.id])
        const cachedLastText = cachedMessages?.[0]?.text ?? cachedMessages?.[0]?.attachments?.[0]?.file_name

        return {
          ...chat,
          cabinet_name: betterCabinetName,
          last_message_text: chat.last_message_text ?? cachedLastText ?? null,
          // Обогащаем имя пользователя из кэша сообщений (берём первого не-оператора)
          user_name:
            chat.user_name ?? chat.user_full_name ??
            getUserNameFromCache(qc, chat.id),
        }
      })
  }, [rawChats, cabinetNameMap, qc])

  const enrichedSelected = selectedChat
    ? (chats.find((c) => c.id === selectedChat.id) ?? selectedChat)
    : null

  // Когда открываем чат — обновляем список (для last_message_text)
  const handleSelect = useCallback((chat: Chat) => {
    setSelectedChat(chat)
    setShowConversation(true)
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Left panel */}
      <div className={`flex-shrink-0 h-full w-72 ${showConversation ? 'hidden md:flex md:flex-col' : 'flex flex-col w-full md:w-72'}`}>
        <ChatListPanel
          chats={chats}
          selectedId={enrichedSelected?.id ?? null}
          onSelect={handleSelect}
          loading={isLoading}
        />
      </div>

      {/* Right panel */}
      <div className={`flex-1 h-full ${showConversation ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
        {enrichedSelected ? (
          <ChatConversation
            key={enrichedSelected.id}
            chat={enrichedSelected}
            onBack={() => setShowConversation(false)}
            onMessagesLoaded={() => {
              // Триггерим пересчёт списка чтобы обновить last_message
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
  // Ищем первое сообщение не от бота (sender_name может содержать имя пользователя)
  const userMsg = msgs.find((m) => m.sender_name && m.sender_name !== 'Bot' && m.sender_name !== 'bot')
  return userMsg?.sender_name ?? null
}

function EmptyState() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3"
      style={{ background: 'linear-gradient(160deg, #f5f7fa 0%, #eaeff8 100%)' }}
    >
      <span className="text-5xl">💬</span>
      <p className="text-sm font-medium text-slate-500">Выберите чат</p>
      <p className="text-xs text-slate-400 text-center max-w-40">
        Выберите чат из списка слева
      </p>
    </div>
  )
}
