'use client'

import { isAxiosError } from 'axios'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Package, FileText, MessageCircle, Bot, Wrench, Archive,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MessageBubble, DateSeparator } from './message-bubble'
import { chatDisplayName } from './chat-list-panel'
import { ImageLightbox } from './attachment-view'
import { chatsApi } from '@/lib/api/chats'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'
import { useChatNavStore } from '@/lib/store/chat-nav'
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'
import type { Chat, ChatMessage, MessageAttachment } from '@/types'
import type { InfiniteData } from '@tanstack/react-query'
import { ForwardDialog } from './forward-dialog'
import { buildRenderItems } from './build-render-items'
import { ForwardIcon, TrashIcon } from './chat-icons'
import { usePinnedMessages } from './hooks/use-pinned-messages'
import { useChatSettings } from './hooks/use-chat-settings'
import { WALLPAPERS } from './wallpapers'
import { ChatAttachmentsPanel } from './chat-attachments-panel'
import { ChatHeader } from './chat-header'
import { PinnedBanner } from './pinned-banner'
import { ChatComposer, STICKERS } from './chat-composer'
import { ChatConfirmDialog } from './chat-confirm-dialog'
import { useRealtimeEvents, type RealtimeEnvelope } from '@/lib/hooks/use-realtime-events'

const MESSAGE_EVENT_TYPES = [
  'message.created', 'message.updated', 'message.deleted',
  'message.reaction_changed', 'message.pinned', 'message.unpinned', 'message.read',
]

interface Props {
  chat: Chat
  onBack?: () => void
  onMessagesLoaded?: () => void
  onChatDeleted?: () => void
}

type MsgPages = InfiniteData<ChatMessage[]>
type PageParam = { before_id?: number; after_id?: number } | undefined

function patchPages(old: MsgPages | undefined, fn: (m: ChatMessage) => ChatMessage): MsgPages | undefined {
  if (!old) return old
  return { ...old, pages: old.pages.map(page => page.map(fn)) }
}

export function ChatConversation({ chat, onBack, onMessagesLoaded, onChatDeleted }: Props) {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const pendingMessageId = useChatNavStore((s) => s.pendingMessageId)
  const clearPendingMessage = useChatNavStore((s) => s.clearPendingMessage)

  useEffect(() => {
    if (!currentUser) authApi.me().then(setUser).catch(() => {})
  }, [currentUser, setUser])

  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const bottomSentinelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const prevScrollHeightRef = useRef<number | null>(null)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)
  const scrolledToUnreadRef = useRef(false)

  const [firstUnreadId, setFirstUnreadId] = useState<number | undefined>(undefined)

  const [text, setText] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<(MessageAttachment & { name: string })[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [forwardMessages, setForwardMessages] = useState<ChatMessage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [attachTab, setAttachTab] = useState<'media' | 'files' | 'voice' | 'colors' | 'wallpaper'>('media')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState<null | 'clear' | 'delete' | 'delete-message' | 'delete-selected'>(null)
  const [deleteMessageId, setDeleteMessageId] = useState<number | null>(null)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [stickerCat, setStickerCat] = useState(Object.keys(STICKERS)[0])
  const [transcriptions, setTranscriptions] = useState<Map<number, { text: string; loading: boolean }>>(new Map())
  const [jumpMode, setJumpMode] = useState(false)
  const jumpTargetRef = useRef<number | null>(null)
  const jumpScrolledRef = useRef(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const [firstNewMessageId, setFirstNewMessageId] = useState<number | null>(null)
  const [isAwayFromBottom, setIsAwayFromBottom] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; messageId: number } | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  // Объявлены здесь (а не рядом с остальными handleXxx ниже), потому что на них
  // ссылаются эффекты выше по файлу — иначе JS TDZ ловит "used before declaration".
  const isNearBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }, [])

  const highlightMessage = useCallback((messageId: number) => {
    const el = document.getElementById(`msg-${messageId}`)
    const container = listRef.current
    if (!el || !container) return false
    const elRect = el.getBoundingClientRect()
    const cRect = container.getBoundingClientRect()
    container.scrollTop += elRect.top - cRect.top - cRect.height / 2 + elRect.height / 2
    el.style.transition = 'background-color 0.3s ease'
    el.style.backgroundColor = 'rgba(74,143,231,0.2)'
    setTimeout(() => { el.style.backgroundColor = '' }, 1500)
    return true
  }, [])

  const handleScrollToMessage = useCallback(async (messageId: number) => {
    if (highlightMessage(messageId)) return
    try {
      const msgs = await chatsApi.getMessagesAround(chat.id, messageId)
      // newest-first page format (same as what the query returns)
      const page = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      jumpTargetRef.current = messageId
      setJumpMode(true)
      qc.setQueryData<MsgPages>(['messages', chat.id], {
        pages: [page],
        pageParams: [undefined],
      })
    } catch {
      toast.error('Не удалось перейти к сообщению')
    }
  }, [highlightMessage, chat.id, qc])

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!headerMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) setHeaderMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [headerMenuOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmModal) { setConfirmModal(null); return }
      if (forwardMessages.length) { setForwardMessages([]); return }
      if (attachmentsOpen) { setAttachmentsOpen(false); return }
      if (stickerPickerOpen) { setStickerPickerOpen(false); return }
      if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); return }
      if (searchOpen) toggleSearch()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectMode, searchOpen, attachmentsOpen, stickerPickerOpen, confirmModal, forwardMessages])

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const { data: messagesData, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage } = useInfiniteQuery<ChatMessage[], Error, MsgPages, ['messages', number], PageParam>({
    queryKey: ['messages', chat.id],
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => chatsApi.getMessages(chat.id, pageParam?.before_id, pageParam?.after_id),
    getNextPageParam: (lastPage) => lastPage.length < 30 ? undefined : { before_id: lastPage[lastPage.length - 1]?.id },
    getPreviousPageParam: (firstPage) => firstPage.length < 30 ? undefined : { after_id: firstPage[0]?.id },
  })

  // Realtime вместо поллинга сообщений — см. README-backend.md, "Realtime (SSE)
  // для операторской панели". message.created дедуплицируется по id (своё же
  // отправленное сообщение уже добавлено локально в sendMutation.onSuccess) и
  // намеренно игнорируется в jumpMode — там pages[0] держит "окрестность"
  // сообщения, к которому прыгнули, а не настоящий хвост переписки.
  //
  // Проверено вживую (curl -N по реальному каналу): data у message.created/updated —
  // полный MessageOut, а у message.deleted/reaction_changed/pinned/unpinned — только
  // {id}, без reactions/deleted_at. Патчить кэш точечным мёрджем для последних трёх
  // нечем, поэтому deleted проставляет deleted_at локально (как раньше делала сама
  // deleteMutation), а reaction_changed/pinned/unpinned просто инвалидируют — ровно
  // так же, как уже делают собственные handleReact/handlePin этого компонента.
  const handleRealtimeEvent = useCallback((envelope: RealtimeEnvelope) => {
    switch (envelope.type) {
      case 'message.created': {
        if (jumpMode) return
        const msg = envelope.data as ChatMessage
        const wasAtBottom = isNearBottom()
        let appended = false
        qc.setQueryData<MsgPages>(['messages', chat.id], (old) => {
          if (!old) return old
          if (old.pages.some(page => page.some(m => m.id === msg.id))) return old
          appended = true
          return { ...old, pages: [[msg, ...(old.pages[0] ?? [])], ...old.pages.slice(1)] }
        })
        if (appended && !wasAtBottom) {
          setNewMessageCount(c => c + 1)
          setFirstNewMessageId(id => id ?? msg.id)
          setIsAwayFromBottom(true)
        }
        return
      }
      case 'message.updated': {
        const msg = envelope.data as ChatMessage
        qc.setQueryData<MsgPages>(['messages', chat.id], (old) => patchPages(old, m => m.id === msg.id ? { ...m, ...msg } : m))
        return
      }
      case 'message.deleted': {
        const { id } = envelope.data as { id: number }
        const deleted_at = new Date().toISOString()
        qc.setQueryData<MsgPages>(['messages', chat.id], (old) => patchPages(old, m => m.id === id ? { ...m, deleted_at } : m))
        return
      }
      case 'message.reaction_changed':
        qc.invalidateQueries({ queryKey: ['messages', chat.id] })
        return
      case 'message.pinned':
      case 'message.unpinned':
        qc.invalidateQueries({ queryKey: ['pinned-messages', chat.id] })
        return
      case 'message.read': {
        // Раньше прочтение никак не публиковалось в SSE — собеседник узнавал
        // о нём только после ручного обновления страницы (см. README-backend.md,
        // событие message.read). Помечаем свои же отправленные сообщения
        // прочитанными без релоада — см. ReadReceiptIcon в message-bubble.tsx.
        const { message_ids } = envelope.data as { message_ids: number[]; reader_id: number }
        const idSet = new Set(message_ids)
        qc.setQueryData<MsgPages>(['messages', chat.id], (old) => patchPages(old, m => idSet.has(m.id) ? { ...m, is_read: true } : m))
      }
    }
  }, [qc, chat.id, jumpMode, isNearBottom])

  const handleRealtimeReconnect = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['messages', chat.id] })
    qc.invalidateQueries({ queryKey: ['pinned-messages', chat.id] })
  }, [qc, chat.id])

  useRealtimeEvents(`/operator/events/chats/${chat.id}`, MESSAGE_EVENT_TYPES, handleRealtimeEvent, handleRealtimeReconnect)

  const { data: searchResults = [] } = useQuery({
    queryKey: ['messages-search', chat.id, searchQuery],
    queryFn: () => chatsApi.getMessages(chat.id, undefined, undefined, searchQuery),
    enabled: searchOpen && searchQuery.length > 0,
  })

  const messages = useMemo(() => {
    const seen = new Set<number>()
    return [...(messagesData?.pages ?? [])].reverse().flatMap(p => [...p].reverse()).filter(m => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return true
    })
  }, [messagesData?.pages])

  const displayMessages = searchOpen && searchQuery ? [...searchResults].reverse() : messages

  useEffect(() => {
    scrolledRef.current = false
    scrolledToUnreadRef.current = false
    jumpScrolledRef.current = false
    setFirstUnreadId(undefined)
    setJumpMode(false)
    jumpTargetRef.current = null
    setNewMessageCount(0)
    setFirstNewMessageId(null)
    setIsAwayFromBottom(false)
  }, [chat.id])
  useEffect(() => { if (messages.length > 0) onMessagesLoaded?.() }, [messages.length])

  useEffect(() => {
    if (!pendingMessageId || messages.length === 0) return
    clearPendingMessage()
    handleScrollToMessage(pendingMessageId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessageId, messages.length === 0])
  useEffect(() => {
    if (messages.length === 0) return
    if (!scrolledRef.current) {
      scrolledRef.current = true
      if (chat.unread_count > 0) {
        const firstUnread = messages.find(m => !m.is_read)
        if (firstUnread) {
          setFirstUnreadId(firstUnread.id)
          return
        }
      }
      bottomRef.current?.scrollIntoView()
      return
    }
    if (jumpTargetRef.current !== null) return
    if (jumpScrolledRef.current) return
    if (isNearBottom()) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isNearBottom])
  useEffect(() => {
    if (!firstUnreadId || scrolledToUnreadRef.current) return
    scrolledToUnreadRef.current = true
    const el = document.getElementById('unread-divider')
    if (el) el.scrollIntoView({ block: 'start' })
    else bottomRef.current?.scrollIntoView()
  }, [firstUnreadId])
  useEffect(() => {
    const el = listRef.current
    if (!el || prevScrollHeightRef.current === null) return
    el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
    prevScrollHeightRef.current = null
  }, [messagesData?.pages.length])
  useEffect(() => {
    const sentinel = topSentinelRef.current
    const container = listRef.current
    if (!sentinel || !container) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        prevScrollHeightRef.current = container.scrollHeight
        fetchNextPage()
      }
    }, { root: container, rootMargin: '80px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    if (chat.unread_count > 0) {
      chatsApi.markRead(chat.id).catch(() => {})
      qc.invalidateQueries({ queryKey: ['operator-chats'] })
    }
  }, [chat.id])

  useEffect(() => {
    if (jumpTargetRef.current === null || messages.length === 0) return
    const id = jumpTargetRef.current
    requestAnimationFrame(() => {
      if (highlightMessage(id)) {
        jumpTargetRef.current = null
        jumpScrolledRef.current = true
      }
    })
  }, [messages, highlightMessage])

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  const { pinnedMessages, pinnedIds, activePin, activePinIdx, setActivePinIdx, handlePin, unpinOne, unpinAll } = usePinnedMessages(chat.id)
  const {
    chatColors, wallpaper, customWallpaperUrl, colorScope, setColorScope,
    saveColor, saveWallpaper, uploadWallpaper, uploadingWallpaper,
  } = useChatSettings(chat.id)

  const { data: rawAttachments = [] } = useQuery({
    queryKey: ['chat-attachments', chat.id],
    queryFn: () => chatsApi.getAttachments(chat.id),
    enabled: attachmentsOpen,
    staleTime: 60_000,
  })

  const sendMutation = useMutation({
    mutationFn: ({ t, attachments, replyToId }: { t: string; attachments?: MessageAttachment[]; replyToId?: number }) =>
      chatsApi.sendMessage(chat.id, t, attachments, replyToId),
    onSuccess: (msg) => {
      qc.setQueryData<MsgPages>(['messages', chat.id], (old) => {
        if (!old) return old
        return { ...old, pages: [[msg, ...(old.pages[0] ?? [])], ...old.pages.slice(1)] }
      })
      qc.setQueriesData<Chat[]>({ queryKey: ['operator-chats'] }, (prev) =>
        prev?.map((c) => c.id === chat.id
          ? { ...c, last_message_text: msg.text || msg.attachments?.[0]?.file_name || c.last_message_text, last_message_at: msg.created_at, unread_count: 0 }
          : c) ?? prev
      )
      setText(''); setPendingAttachments([]); setReplyTo(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      setNewMessageCount(0)
      setFirstNewMessageId(null)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    },
    onError: () => toast.error('Не удалось отправить'),
  })

  const editMutation = useMutation({
    mutationFn: ({ messageId, newText }: { messageId: number; newText: string }) =>
      chatsApi.editMessage(chat.id, messageId, newText),
    onSuccess: (updated) => {
      qc.setQueryData<MsgPages>(['messages', chat.id], (old) => patchPages(old, m => m.id === updated.id ? updated : m))
      setText(''); setEditingMessage(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    onError: () => toast.error('Не удалось изменить сообщение'),
  })

  const deleteMutation = useMutation({
    mutationFn: (messageId: number) => chatsApi.deleteMessage(chat.id, messageId),
    onSuccess: (_, messageId) => {
      const deleted_at = new Date().toISOString()
      qc.setQueryData<MsgPages>(['messages', chat.id], (old) => patchPages(old, m => m.id === messageId ? { ...m, deleted_at } : m))
    },
    onError: () => toast.error('Не удалось удалить сообщение'),
  })

  const takeMutation = useMutation({
    mutationFn: () => chatsApi.takeChat(chat.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operator-chats'] }); toast.success('Чат взят — теперь вы можете отвечать') },
    onError: () => toast.error('Не удалось взять чат'),
  })

  const botMutation = useMutation({
    mutationFn: () => chatsApi.returnToBot(chat.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['operator-chats'] }); toast.success('Чат передан боту') },
  })

  const clearMutation = useMutation({
    mutationFn: () => chatsApi.clearHistory(chat.id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['messages', chat.id] })
      setConfirmModal(null)
      toast.success('История очищена')
    },
    onError: () => toast.error('Не удалось очистить историю'),
  })

  const deleteChatMutation = useMutation({
    mutationFn: () => chatsApi.deleteChat(chat.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-chats'] })
      setConfirmModal(null)
      toast.success('Чат удалён')
      onChatDeleted?.()
    },
    onError: () => toast.error('Не удалось удалить чат'),
  })

  const handleReact = useCallback(async (msg: ChatMessage, emoji: string) => {
    const myId = currentUser?.id ?? -1
    const alreadyReacted = (msg.reactions ?? []).some(r => r.emoji === emoji && r.user_id === myId)
    try {
      if (alreadyReacted) await chatsApi.removeReaction(chat.id, msg.id, emoji)
      else await chatsApi.addReaction(chat.id, msg.id, emoji)
      qc.invalidateQueries({ queryKey: ['messages', chat.id] })
    } catch {
      toast.error('Не удалось обновить реакцию')
    }
  }, [chat.id, currentUser?.id, qc])

  const handleVoiceFinish = useCallback(async (blob: Blob, duration: number) => {
    try {
      const { url } = await chatsApi.uploadVoice(blob)
      sendMutation.mutate({ t: '', attachments: [{ file_url: url, file_name: 'Голосовое сообщение', file_size_bytes: blob.size, mime_type: blob.type || 'audio/ogg', duration_seconds: duration }] })
    } catch {
      toast.error('Не удалось отправить голосовое')
    }
  }, [sendMutation])

  const voice = useVoiceRecorder(handleVoiceFinish)

  const uploadFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      setUploadingFile(true)
      try {
        const { url } = await chatsApi.uploadAttachment(file)
        setPendingAttachments((prev) => [...prev, { file_url: url, file_name: file.name, file_size_bytes: file.size, mime_type: file.type, name: file.name, duration_seconds: null }])
      } catch {
        toast.error(`Не удалось загрузить ${file.name}`)
      } finally {
        setUploadingFile(false)
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    await uploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false) }
  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files) }

  const handleSend = () => {
    if (editingMessage) {
      const t = text.trim()
      if (t) editMutation.mutate({ messageId: editingMessage.id, newText: t })
      return
    }
    const t = text.trim()
    if (!t && pendingAttachments.length === 0) return
    sendMutation.mutate({ t, attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined, replyToId: replyTo?.id })
  }

  const cancelContext = () => {
    if (editingMessage) { setEditingMessage(null); setText('') }
    else setReplyTo(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
    if (e.key === 'Escape') cancelContext()
  }

  const handleListScroll = useCallback(() => {
    const atBottom = isNearBottom()
    setIsAwayFromBottom(!atBottom)
    if (atBottom && newMessageCount > 0) {
      setNewMessageCount(0)
      setFirstNewMessageId(null)
    }
  }, [newMessageCount, isNearBottom])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setNewMessageCount(0)
    setFirstNewMessageId(null)
  }, [])

  // Стрелка «вниз»: если пока сидели выше низа пришли новые сообщения — ведёт
  // к первому из них (highlightMessage — оно уже в DOM, т.к. добавлено в кэш
  // напрямую в handleRealtimeEvent, а не отдельной подгрузкой), иначе — в самый низ.
  const handleJumpButtonClick = useCallback(() => {
    if (newMessageCount > 0 && firstNewMessageId != null) {
      highlightMessage(firstNewMessageId)
      setNewMessageCount(0)
      setFirstNewMessageId(null)
      return
    }
    scrollToBottom()
  }, [newMessageCount, firstNewMessageId, highlightMessage, scrollToBottom])

  const handleReply = useCallback((msg: ChatMessage) => { setReplyTo(msg); setEditingMessage(null); textareaRef.current?.focus() }, [])
  const handleEdit = useCallback((msg: ChatMessage) => {
    setEditingMessage(msg); setReplyTo(null); setText(msg.text ?? '')
    setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus(); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
    }, 0)
  }, [])

  const exitJumpMode = async () => {
    setJumpMode(false)
    jumpTargetRef.current = null
    jumpScrolledRef.current = false
    setNewMessageCount(0)
    setFirstNewMessageId(null)
    await qc.resetQueries({ queryKey: ['messages', chat.id] })
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (!jumpMode) return
    const sentinel = bottomSentinelRef.current
    const container = listRef.current
    if (!sentinel || !container) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !jumpScrolledRef.current) return
      if (hasPreviousPage && !isFetchingPreviousPage) {
        fetchPreviousPage()
      } else if (!hasPreviousPage) {
        exitJumpMode()
      }
    }, { root: container, rootMargin: '80px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpMode, hasPreviousPage, isFetchingPreviousPage, fetchPreviousPage])

  const toggleSearch = () => { setSearchOpen(v => !v); setSearchInput(''); setSearchQuery('') }

  const handleSelectMessage = useCallback((msg: ChatMessage) => {
    setSelectMode(true)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(msg.id)) next.delete(msg.id)
      else next.add(msg.id)
      return next
    })
  }, [])

  const handleCancelSelect = () => { setSelectMode(false); setSelectedIds(new Set()) }

  const handleDeleteSelected = () => setConfirmModal('delete-selected')

  const confirmDeleteSelected = () => {
    selectedIds.forEach(id => deleteMutation.mutate(id))
    handleCancelSelect()
    setConfirmModal(null)
  }

  const confirmDeleteMessage = () => {
    if (deleteMessageId != null) deleteMutation.mutate(deleteMessageId)
    setDeleteMessageId(null)
    setConfirmModal(null)
  }

  const handleForwardSelected = () => {
    // все выбранные, в хронологическом порядке (как в ленте)
    const selected = messages.filter(m => selectedIds.has(m.id))
    if (selected.length) setForwardMessages(selected)
    handleCancelSelect()
  }

  const handleTranscribe = useCallback(async (msg: ChatMessage, audioUrl: string) => {
    setTranscriptions(prev => new Map(prev).set(msg.id, { text: '', loading: true }))
    try {
      // file_url — относительный путь /static/voices/...; файл уже загружен через /upload/voice
      const { text: result } = await chatsApi.transcribeVoice(audioUrl)
      setTranscriptions(prev => new Map(prev).set(msg.id, { text: result, loading: false }))
    } catch (e) {
      setTranscriptions(prev => { const next = new Map(prev); next.delete(msg.id); return next })
      const status = isAxiosError(e) ? e.response?.status : undefined
      toast.error(
        status === 400 ? 'Не удалось распознать этот файл'
        : status === 404 ? 'Файл недоступен'
        : status === 503 ? 'Распознавание временно недоступно, попробуйте позже'
        : 'Не удалось распознать голосовое'
      )
    }
  }, [])

  const handleDeleteMessage = useCallback((msg: ChatMessage) => {
    setDeleteMessageId(msg.id)
    setConfirmModal('delete-message')
  }, [])

  const handleForwardMessage = useCallback((msg: ChatMessage) => {
    setForwardMessages([msg])
  }, [])

  const canSend = !sendMutation.isPending && !editMutation.isPending && !voice.recording && !uploadingFile
  const inputDisabled = voice.recording || uploadingFile
  const botActive = chat.bot_active
  // archived_at — флаг состояния чата (см. README-backend.md, "Рут `chats`"):
  // проставляется автоматически при закрытии заявки, сбрасывается при повторном
  // открытии. Архивный чат read-only на бэкенде (POST .../messages -> 403).
  const isArchivedRequest = !!chat.archived_at
  const renderItems = buildRenderItems(displayMessages, currentUser?.id ?? -1, firstUnreadId)
  const name = chatDisplayName(chat)
  const AvatarIcon = chat.chat_type === 'cabinet' ? Package : chat.chat_type === 'notes' ? FileText : chat.chat_type === 'service_request' ? Wrench : MessageCircle
  const avatarBg = chat.chat_type === 'cabinet' ? 'bg-[#1B3A72]' : 'bg-slate-500'
  const currentWallpaper = WALLPAPERS.find(w => w.id === wallpaper) ?? WALLPAPERS[0]

  const allAttachments = useMemo(() => {
    const media: { message_id: number; url: string; mime: string }[] = []
    const files: { message_id: number; name: string; url: string; mime: string; size: number }[] = []
    const voices: { message_id: number; url: string; duration: number | null }[] = []
    for (const a of rawAttachments) {
      if (a.mime_type.startsWith('image/') || a.mime_type.startsWith('video/')) {
        media.push({ message_id: a.message_id, url: a.file_url, mime: a.mime_type })
      } else if (a.mime_type.startsWith('audio/')) {
        voices.push({ message_id: a.message_id, url: a.file_url, duration: a.duration_seconds })
      } else {
        files.push({ message_id: a.message_id, name: a.file_name, url: a.file_url, mime: a.mime_type, size: a.file_size_bytes })
      }
    }
    return { media, files, voices }
  }, [rawAttachments])

  return (
    <div className="flex flex-col h-full relative">
      <ChatHeader
        onBack={onBack}
        searchOpen={searchOpen}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onToggleSearch={() => { toggleSearch(); setHeaderMenuOpen(false) }}
        name={name}
        avatarBg={avatarBg}
        AvatarIcon={AvatarIcon}
        botActive={botActive}
        hideBotControls={chat.chat_type === 'service_request'}
        operatorRequested={chat.operator_requested}
        onAvatarClick={() => { setAttachmentsOpen(true); setAttachTab('media') }}
        onTake={() => { takeMutation.mutate(); setHeaderMenuOpen(false) }}
        takePending={takeMutation.isPending}
        onReturnToBot={() => { botMutation.mutate(); setHeaderMenuOpen(false) }}
        returnToBotPending={botMutation.isPending}
        headerMenuOpen={headerMenuOpen}
        onToggleHeaderMenu={() => setHeaderMenuOpen(v => !v)}
        headerMenuRef={headerMenuRef}
        pinnedCount={pinnedMessages.length}
        onJumpToPinned={() => { if (activePin) handleScrollToMessage(activePin.id); setHeaderMenuOpen(false) }}
        onUnpinAll={() => { unpinAll(); setHeaderMenuOpen(false) }}
        onClearHistory={() => { setConfirmModal('clear'); setHeaderMenuOpen(false) }}
        onDeleteChat={() => { setConfirmModal('delete'); setHeaderMenuOpen(false) }}
      />

      {!!activePin && !searchOpen && (
        <PinnedBanner
          activePin={activePin}
          pinnedMessages={pinnedMessages}
          activePinIdx={activePinIdx}
          onAdvance={() => setActivePinIdx(i => (i + 1) % pinnedMessages.length)}
          onJumpToMessage={handleScrollToMessage}
          onUnpin={unpinOne}
        />
      )}

      {searchOpen && searchQuery && (
        <div className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 shrink-0">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {searchResults.length > 0 ? `Найдено: ${searchResults.length} сообщений` : 'Ничего не найдено'}
          </p>
        </div>
      )}

      <div
        ref={listRef}
        style={customWallpaperUrl
          ? { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: isDarkMode ? currentWallpaper.dark : currentWallpaper.light }
        }
        className={cn('flex-1 overflow-y-auto px-2 py-1 relative', isDragOver && 'ring-2 ring-inset ring-[#4A8FE7]')}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        onScroll={handleListScroll}
      >
        {isDragOver && (
          <div className="absolute inset-0 bg-[#4A8FE7]/10 flex flex-col items-center justify-center z-20 pointer-events-none">
            <svg className="w-12 h-12 text-[#4A8FE7] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            <p className="text-[#4A8FE7] font-medium text-sm">Перетащите файлы сюда</p>
          </div>
        )}
        {/* Ограничение ширины ленты — на широких мониторах (2560px+) панель разговора растягивается
            на весь остаток экрана, а пузыри (max-w-% от родителя) без этого стали бы нечитаемо широкими.
            100rem (1600px) выбран щедрым: не включается на обычных десктопных ширинах, только на очень широких панелях */}
        <div className="max-w-[100rem] mx-auto space-y-1">
        <div ref={topSentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-[#1B3A72] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {isLoading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#1B3A72] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!isLoading && renderItems.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-16">
            <MessageCircle className="w-10 h-10 opacity-50" />
            <p className="text-sm">{searchOpen && searchQuery ? 'Ничего не найдено' : 'Нет сообщений'}</p>
          </div>
        )}
        {renderItems.map((item, i) =>
          item.type === 'date' ? (
            <DateSeparator key={`d-${i}`} date={item.date} />
          ) : item.type === 'unread-divider' ? (
            <div key="unread-divider" id="unread-divider" className="flex items-center gap-3 my-2 px-2">
              <div className="flex-1 h-px bg-blue-300 dark:bg-blue-700" />
              <span className="text-xs font-medium text-blue-500 dark:text-blue-400 shrink-0">Новые сообщения</span>
              <div className="flex-1 h-px bg-blue-300 dark:bg-blue-700" />
            </div>
          ) : (
            <MessageBubble
              key={item.message.id}
              message={item.message}
              isOwn={item.isOwn}
              isBot={item.isBot}
              showAvatar={item.showAvatar}
              showName={item.showName}
              isLastInGroup={item.isLastInGroup}
              messagesById={messagesById}
              currentUserId={currentUser?.id}
              pinnedMessageIds={pinnedIds}
              onReply={handleReply}
              onEdit={item.isOwn ? handleEdit : undefined}
              onDelete={item.isOwn ? handleDeleteMessage : undefined}
              onForward={handleForwardMessage}
              onReact={handleReact}
              onScrollToMessage={handleScrollToMessage}
              onPin={handlePin}
              onSelect={handleSelectMessage}
              isSelected={selectedIds.has(item.message.id)}
              selectMode={selectMode}
              transcription={transcriptions.get(item.message.id)?.text}
              transcribing={transcriptions.get(item.message.id)?.loading}
              onTranscribe={handleTranscribe}
              ownBubbleColor={chatColors.ownBubble}
              otherBubbleColor={chatColors.otherBubble}
              botBubbleColor={chatColors.botBubble}
              nickColor={chatColors.nickColor}
              fontSize={chatColors.fontSize}
              ownTextColor={chatColors.ownText}
              otherTextColor={chatColors.otherText}
              botTextColor={chatColors.botText}
            />
          )
        )}
        <div ref={bottomSentinelRef} className="h-1" />
        {isFetchingPreviousPage && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 border-2 border-[#1B3A72] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <div ref={bottomRef} />
        </div>
      </div>

      {/* Вынесены из listRef (там координаты absolute считались бы от нижнего края
          самого списка сообщений, который "плавает" при росте композера — реплай,
          вложения, многострочный текст сокращают flex-1 списка и сдвигают кнопку
          вместе с ним). Здесь bottom считается от стабильного по высоте (h-full)
          корня компонента, поэтому кнопка всегда в одном и том же месте. */}
      {jumpMode && (
        <button
          onClick={exitJumpMode}
          className="absolute bottom-20 right-4 z-30 flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-full px-3 py-1.5 text-xs font-medium text-[#1B3A72] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          Последние ↓
        </button>
      )}
      {!jumpMode && isAwayFromBottom && (
        <button
          onClick={handleJumpButtonClick}
          title={newMessageCount > 0 ? 'К первому новому сообщению' : 'В конец'}
          className="absolute bottom-20 right-4 z-30 w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-full text-[#1B3A72] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {newMessageCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 bg-[#1B3A72] text-white text-[10px] rounded-full flex items-center justify-center px-1 font-bold leading-none">
              {newMessageCount > 99 ? '99+' : newMessageCount}
            </span>
          )}
        </button>
      )}

      {isArchivedRequest && !searchOpen && !selectMode && (
        <div className="border-t border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 shrink-0">
          <div className="flex items-center gap-3">
            <Archive className="w-6 h-6 text-slate-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Заявка закрыта — чат в архиве</p>
              <p className="text-xs text-slate-400 mt-0.5">Только чтение, отправка сообщений недоступна</p>
            </div>
          </div>
        </div>
      )}

      {botActive && !isArchivedRequest && !searchOpen && !selectMode && (
        <div className="border-t border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 shrink-0">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Сейчас отвечает бот</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Чтобы ответить самостоятельно — возьмите чат</p>
            </div>
            <button onClick={() => takeMutation.mutate()} disabled={takeMutation.isPending}
              className="bg-[#1B3A72] text-white text-sm px-4 py-2 rounded-xl hover:bg-[#1B3A72]/90 transition-colors font-medium shrink-0 cursor-pointer">
              {takeMutation.isPending ? 'Загрузка...' : 'Взять чат'}
            </button>
          </div>
        </div>
      )}

      {selectMode && (
        <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 shrink-0">
          <button onClick={handleCancelSelect}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Отмена
          </button>
          <span className="flex-1 text-sm text-center font-medium text-slate-700 dark:text-slate-300">
            {selectedIds.size > 0 ? `Выбрано: ${selectedIds.size}` : 'Выберите сообщения'}
          </span>
          {selectedIds.size > 0 && (
            <>
              <button onClick={handleForwardSelected}
                className="flex items-center gap-1.5 text-sm text-[#1B3A72] dark:text-blue-400 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <ForwardIcon />Переслать
              </button>
              <button onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 text-sm text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer">
                <TrashIcon />Удалить
              </button>
            </>
          )}
        </div>
      )}

      {!botActive && !isArchivedRequest && !searchOpen && !selectMode && (
        <ChatComposer
          stickerPickerOpen={stickerPickerOpen}
          onToggleStickerPicker={() => setStickerPickerOpen(v => !v)}
          stickerCat={stickerCat}
          onStickerCatChange={setStickerCat}
          onPickSticker={(sticker) => { sendMutation.mutate({ t: sticker }); setStickerPickerOpen(false) }}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={(i) => setPendingAttachments((p) => p.filter((_, j) => j !== i))}
          replyTo={replyTo}
          editingMessage={editingMessage}
          onCancelContext={cancelContext}
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          voice={voice}
          canSend={canSend}
          uploadingFile={uploadingFile}
          text={text}
          onTextChange={setText}
          onKeyDown={handleKeyDown}
          inputDisabled={inputDisabled}
          textareaRef={textareaRef}
          onSend={handleSend}
        />
      )}

      {forwardMessages.length > 0 && (
        <ForwardDialog messages={forwardMessages} currentChatId={chat.id} onClose={() => setForwardMessages([])} />
      )}

      {attachmentsOpen && (
        <ChatAttachmentsPanel
          onClose={() => setAttachmentsOpen(false)}
          name={name}
          avatarBg={avatarBg}
          AvatarIcon={AvatarIcon}
          botActive={botActive}
          hideBotControls={chat.chat_type === 'service_request'}
          attachTab={attachTab}
          onTabChange={setAttachTab}
          allAttachments={allAttachments}
          onOpenImage={(fullUrl) => setLightbox({ url: fullUrl, name: '' })}
          onJumpToMessage={(id) => { setAttachmentsOpen(false); setTimeout(() => handleScrollToMessage(id), 100) }}
          onContextMenu={(e, messageId) => setCtxMenu({ x: e.clientX, y: e.clientY, messageId })}
          chatColors={chatColors}
          saveColor={saveColor}
          colorScope={colorScope}
          onColorScopeChange={setColorScope}
          wallpaper={wallpaper}
          customWallpaperUrl={customWallpaperUrl}
          onSelectWallpaper={(id) => saveWallpaper({ wallpaper_id: id === 'default' ? null : id, wallpaper_url: null })}
          onResetWallpaper={() => saveWallpaper({ wallpaper_id: null, wallpaper_url: null })}
          onUploadWallpaper={uploadWallpaper}
          uploadingWallpaper={uploadingWallpaper}
          isDarkMode={isDarkMode}
        />
      )}

      {lightbox && <ImageLightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />}

      {ctxMenu && (
        <div className="fixed inset-0 z-50" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }}>
          <div
            className="absolute bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 min-w-45"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-left"
              onClick={() => { setCtxMenu(null); setAttachmentsOpen(false); setTimeout(() => handleScrollToMessage(ctxMenu.messageId), 100) }}
            >
              <svg className="w-4 h-4 text-[#1B3A72] dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Перейти к сообщению
            </button>
          </div>
        </div>
      )}

      {confirmModal && (() => {
        const cfg = {
          clear: {
            title: 'Очистить историю?',
            body: 'Все сообщения будут удалены без возможности восстановления.',
            label: 'Очистить',
            onConfirm: () => clearMutation.mutate(),
            pending: clearMutation.isPending,
          },
          delete: {
            title: 'Удалить чат?',
            body: 'Чат и вся история будут удалены навсегда.',
            label: 'Удалить',
            onConfirm: () => deleteChatMutation.mutate(),
            pending: deleteChatMutation.isPending,
          },
          'delete-message': {
            title: 'Удалить сообщение?',
            body: 'Сообщение будет удалено без возможности восстановления.',
            label: 'Удалить',
            onConfirm: confirmDeleteMessage,
            pending: deleteMutation.isPending,
          },
          'delete-selected': {
            title: 'Удалить сообщения?',
            body: `Будет удалено сообщений: ${selectedIds.size}. Это действие нельзя отменить.`,
            label: 'Удалить',
            onConfirm: confirmDeleteSelected,
            pending: deleteMutation.isPending,
          },
        }[confirmModal]
        return (
          <ChatConfirmDialog
            title={cfg.title}
            body={cfg.body}
            label={cfg.label}
            pending={cfg.pending}
            onConfirm={cfg.onConfirm}
            onCancel={() => setConfirmModal(null)}
          />
        )
      })()}
    </div>
  )
}
