'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageCircle } from 'lucide-react'
import { ChatListPanel } from './chat-list-panel'
import { ChatConversation } from './chat-conversation'
import { chatsApi } from '@/lib/api/chats'
import { cabinetsApi } from '@/lib/api/cabinets'
import { useChatNavStore } from '@/lib/store/chat-nav'
import { usePersistentState } from '@/lib/hooks/use-persistent-state'
import { useRealtimeEvents } from '@/lib/hooks/use-realtime-events'
import { attachmentPreviewLabel } from './attachment-view'
import type { Chat, ChatMessage } from '@/types'

const CHAT_LIST_EVENT_TYPES = ['chat.created', 'chat.updated']

const DEFAULT_WIDTH = 288
const MIN_WIDTH = 56       
const MAX_WIDTH = 480
const COMPACT_SNAP = 90   

export function ChatsPage() {
  const qc = useQueryClient()
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [showConversation, setShowConversation] = useState(false)

  const pendingChatId = useChatNavStore((s) => s.pendingChatId)
  const setPendingChatId = useChatNavStore((s) => s.setPendingChatId)
  // id чата, для которого уже переключали список (активные ↔ архив), чтобы
  // не уйти в бесконечное переключение, когда чата нет ни там, ни там
  const pendingProbedRef = useRef<number | null>(null)
  const [chatSearchInput, setChatSearchInput] = useState('')
  const [chatSearch, setChatSearch] = useState('')

  const [panelWidth, setPanelWidth] = usePersistentState('sidebar-width-chats', DEFAULT_WIDTH)
  const [isSnapping, setIsSnapping] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.current + delta))
      setPanelWidth(next)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setPanelWidth(w => {
        if (w < COMPACT_SNAP) {
          setIsSnapping(true)
          setTimeout(() => setIsSnapping(false), 200)
          return MIN_WIDTH
        }
        return w
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [])

  const isCompact = panelWidth <= COMPACT_SNAP

  useEffect(() => {
    const t = setTimeout(() => setChatSearch(chatSearchInput), 300)
    return () => clearTimeout(t)
  }, [chatSearchInput])

  const [archived, setArchived] = useState(false)

  const { data: rawChats = [], isLoading } = useQuery({
    queryKey: ['operator-chats', chatSearch, archived],
    queryFn: () => chatsApi.getChats({ search: chatSearch || undefined, archived }),
  })

  // Realtime вместо поллинга — см. README-backend.md, "Realtime (SSE) для
  // операторской панели". Доставка at-most-once, поэтому по факту реконнекта
  // (после разрыва соединения) дополнительно перезапрашиваем список целиком.
  useRealtimeEvents(
    '/operator/events/chats',
    CHAT_LIST_EVENT_TYPES,
    () => qc.invalidateQueries({ queryKey: ['operator-chats'] }),
    () => qc.invalidateQueries({ queryKey: ['operator-chats'] })
  )

  const { data: cabinetsData } = useQuery({
    queryKey: ['cabinets-for-chat'],
    queryFn: () => cabinetsApi.getAll({ size: 100 }),
    staleTime: 60_000,
  })

  const cabinetNameMap = useMemo(() => {
    const map = new Map<number, string>()
    cabinetsData?.items.forEach((c) => map.set(c.id, c.object_number))
    return map
  }, [cabinetsData])

  const chats = useMemo<Chat[]>(() => {
    return rawChats
      .filter((c) => c.chat_type !== 'notes')
      .map((chat) => ({
        ...chat,
        cabinet_name: chat.cabinet_id ? (cabinetNameMap.get(chat.cabinet_id) ?? chat.cabinet_name) : chat.cabinet_name,
        last_message_text: chat.last_message_text ?? (() => {
          // Кэш useInfiniteQuery — это {pages, pageParams}, а не плоский массив;
          // самое новое сообщение — pages[0][0] (см. chat-conversation.tsx).
          // Работает только для чатов, которые уже открывали в этой сессии —
          // GET /operator/chats сам по себе типа вложения не отдаёт.
          const cached = qc.getQueryData<InfiniteData<ChatMessage[]>>(['messages', chat.id])
          const last = cached?.pages?.[0]?.[0]
          if (!last) return null
          if (last.text) return last.text
          const att = last.attachments?.[0]
          return att ? attachmentPreviewLabel(att) : null
        })(),
        user_name: chat.user_name ?? chat.user_full_name ?? getUserNameFromCache(qc, chat.id),
      }))
  }, [rawChats, cabinetNameMap, qc])

  const enrichedSelected = selectedChat ? (chats.find((c) => c.id === selectedChat.id) ?? selectedChat) : null

  // Переход «открыть чат заявки» кладёт id в стор. Быстрый путь — чат уже есть
  // в загруженном списке. Если нет (список отфильтрован поиском, чат в архиве,
  // а показаны активные, или просто ещё не подгружен) — запрашиваем чат
  // напрямую по id через GET /operator/chats/{chat_id}, а не гадаем,
  // переключая архив/список туда-сюда в расчёте на удачу.
  useEffect(() => {
    if (!pendingChatId) { pendingProbedRef.current = null; return }
    if (isLoading) return

    const chat = chats.find((c) => c.id === pendingChatId)
    if (chat) {
      setSelectedChat(chat)
      setShowConversation(true)
      setPendingChatId(null)
      pendingProbedRef.current = null
      return
    }

    if (pendingProbedRef.current === pendingChatId) return
    pendingProbedRef.current = pendingChatId

    chatsApi.getChat(pendingChatId)
      .then((fetchedChat) => {
        // Поиск и неверная папка (архив/активные) могли бы скрыть чат в
        // списке — синхронизируем оба фильтра под найденный чат.
        if (chatSearch || chatSearchInput) { setChatSearchInput(''); setChatSearch('') }
        setArchived(!!fetchedChat.archived_at)
        setSelectedChat(fetchedChat)
        setShowConversation(true)
        setPendingChatId(null)
        pendingProbedRef.current = null
      })
      .catch(() => {
        setPendingChatId(null)
        pendingProbedRef.current = null
        toast.error('Чат заявки не найден')
      })
  }, [pendingChatId, chats, isLoading, chatSearch, chatSearchInput, setPendingChatId])

  const handleSelect = useCallback((chat: Chat) => {
    setSelectedChat(chat)
    setShowConversation(true)
  }, [])

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      <div
        className={`shrink-0 h-full overflow-hidden flex flex-col ${
          showConversation ? 'hidden md:flex' : 'flex w-full'
        } ${isSnapping ? 'transition-[width] duration-150' : ''}`}
        style={isDesktop ? { width: panelWidth } : undefined}
      >
        <ChatListPanel
          chats={chats}
          selectedId={enrichedSelected?.id ?? null}
          onSelect={handleSelect}
          onSelectChatId={(id) => {
            const chat = chats.find((c) => c.id === id)
            if (chat) handleSelect(chat)
            else setPendingChatId(id)
          }}
          loading={isLoading}
          compact={isCompact && isDesktop}
          searchValue={chatSearchInput}
          onSearchChange={setChatSearchInput}
          archived={archived}
          onToggleArchived={() => {
            setArchived(v => !v)
            setSelectedChat(null)
            setShowConversation(false)
          }}
        />
      </div>

      <div
        onMouseDown={handleDragStart}
        className="hidden md:flex w-1 shrink-0 cursor-col-resize items-center justify-center group relative bg-slate-200 dark:bg-slate-700 hover:bg-[#4A8FE7]/60 transition-colors duration-100 z-10"
        title="Потяните для изменения ширины"
      >
        <div className="flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-[3px] h-[3px] rounded-full bg-[#4A8FE7]" />
          ))}
        </div>
      </div>

      <div className={`flex-1 h-full min-w-0 ${showConversation ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
        {enrichedSelected ? (
          <ChatConversation
            key={enrichedSelected.id}
            chat={enrichedSelected}
            onBack={() => setShowConversation(false)}
            onMessagesLoaded={() => {
              qc.invalidateQueries({ queryKey: ['operator-chats'], refetchType: 'none' })
            }}
            onChatDeleted={() => { setSelectedChat(null); setShowConversation(false) }}
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
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 bg-[linear-gradient(160deg,#f5f7fa_0%,#eaeff8_100%)] dark:[background:linear-gradient(160deg,#1a2236_0%,#1e2744_100%)]">
      <MessageCircle className="w-12 h-12 opacity-50" />
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Выберите чат</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-40">Выберите чат из списка слева</p>
    </div>
  )
}
