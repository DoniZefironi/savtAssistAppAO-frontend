'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MessageBubble, DateSeparator } from './message-bubble'
import { chatDisplayName } from './chat-list-panel'
import { toFullUrl, downloadBlob, ImageLightbox } from './attachment-view'
import { chatsApi } from '@/lib/api/chats'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'
import { useChatNavStore } from '@/lib/store/chat-nav'
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'
import type { Chat, ChatMessage, MessageAttachment } from '@/types'
import type { InfiniteData } from '@tanstack/react-query'

const GROUP_GAP_MS = 5 * 60 * 1000

const WALLPAPERS = [
  { id: 'default',  label: 'Обычный', light: 'linear-gradient(160deg,#f5f7fa 0%,#eaeff8 100%)', dark: 'linear-gradient(160deg,#1a2236 0%,#1e2744 100%)' },
  { id: 'blue',     label: 'Синий',   light: 'linear-gradient(135deg,#dfe9f3 0%,#b8cce4 100%)', dark: 'linear-gradient(135deg,#1a2d42 0%,#1e3a5c 100%)' },
  { id: 'mint',     label: 'Мята',    light: 'linear-gradient(135deg,#d4f1e4 0%,#b2dfe8 100%)', dark: 'linear-gradient(135deg,#102d22 0%,#14323a 100%)' },
  { id: 'sand',     label: 'Песок',   light: 'linear-gradient(135deg,#fdf6e3 0%,#f0e4d0 100%)', dark: 'linear-gradient(135deg,#2d2518 0%,#2a1e0e 100%)' },
  { id: 'lavender', label: 'Лаванда', light: 'linear-gradient(135deg,#e8d5f5 0%,#d4b8f0 100%)', dark: 'linear-gradient(135deg,#1e1230 0%,#231540 100%)' },
  { id: 'dark',     label: 'Тёмный',  light: '#1e293b', dark: '#0f172a' },
]

const STICKERS: Record<string, string[]> = {
  '😊': ['😀','😂','🥹','😍','🥰','😎','😢','😡','🤔','😴','🤗','🤩','😇','🥳','🙄','😬','🤐','😤'],
  '👍': ['👍','👎','❤️','💯','🙏','🤝','✌️','👏','🫡','💪','🤞','🫶','🎉','🔥','⭐','✨','💥','🎊'],
  '🐾': ['🐶','🐱','🐰','🦊','🐻','🐼','🐯','🦁','🐸','🐙','🦋','🌸','🌈','🍀','🌊','🔮','🎭','🎸'],
}

interface Props {
  chat: Chat
  onBack?: () => void
  onMessagesLoaded?: () => void
  onChatDeleted?: () => void
}

type MsgPages = InfiniteData<ChatMessage[]>
type PageParam = { before_id?: number; after_id?: number } | undefined

type ChatColors = { ownBubble?: string; otherBubble?: string; botBubble?: string; nickColor?: string; fontSize?: number; ownText?: string; otherText?: string; botText?: string }

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
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [wallpaper, setWallpaper] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default'
    if (chat.wallpaper_id && chat.wallpaper_id !== 'custom') return chat.wallpaper_id
    return localStorage.getItem(`chat-wallpaper-${chat.id}`) ?? 'default'
  })
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    if (chat.wallpaper_id === 'custom' && chat.wallpaper_url) return chat.wallpaper_url
    return localStorage.getItem(`chat-wallpaper-custom-${chat.id}`)
  })
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false)
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [attachTab, setAttachTab] = useState<'media' | 'files' | 'voice' | 'colors' | 'wallpaper'>('media')
  const [chatColors, setChatColors] = useState<ChatColors>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const g = localStorage.getItem('chat-colors-global')
      const p = localStorage.getItem(`chat-colors-${chat.id}`)
      return { ...(g ? JSON.parse(g) : {}), ...(p ? JSON.parse(p) : {}) }
    } catch { return {} }
  })
  const [colorScope, setColorScope] = useState<'chat' | 'global'>('chat')
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState<null | 'clear' | 'delete'>(null)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [stickerCat, setStickerCat] = useState(Object.keys(STICKERS)[0])
  const [transcriptions, setTranscriptions] = useState<Map<number, { text: string; loading: boolean }>>(new Map())
  const [jumpMode, setJumpMode] = useState(false)
  const jumpTargetRef = useRef<number | null>(null)
  const jumpScrolledRef = useRef(false)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; messageId: number } | null>(null)
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
  )
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
      if (forwardTarget) { setForwardTarget(null); return }
      if (attachmentsOpen) { setAttachmentsOpen(false); return }
      if (stickerPickerOpen) { setStickerPickerOpen(false); return }
      if (selectMode) { setSelectMode(false); setSelectedIds(new Set()); return }
      if (searchOpen) toggleSearch()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectMode, searchOpen, attachmentsOpen, stickerPickerOpen, confirmModal, forwardTarget])

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
    refetchInterval: jumpMode ? false : 1500,
    refetchIntervalInBackground: false,
  })

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
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])
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
  }, [messages])

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  const { data: fetchedPinnedMessage = null } = useQuery({
    queryKey: ['pinned-message', chat.id],
    queryFn: () => chatsApi.getPinnedMessage(chat.id),
    enabled: !!chat.pinned_message_id,
    staleTime: 60_000,
  })
  const pinnedMessage = chat.pinned_message_id
    ? (fetchedPinnedMessage ?? messagesById.get(chat.pinned_message_id) ?? null)
    : null

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

  const pinMutation = useMutation({
    mutationFn: (messageId: number) => chatsApi.pinMessage(chat.id, messageId),
    onSuccess: (_, messageId) => {
      qc.setQueriesData<Chat[]>({ queryKey: ['operator-chats'] }, prev =>
        prev?.map(c => c.id === chat.id ? { ...c, pinned_message_id: messageId } : c) ?? prev
      )
      toast.success('Сообщение закреплено')
    },
    onError: () => toast.error('Не удалось закрепить'),
  })

  const unpinMutation = useMutation({
    mutationFn: () => chatsApi.unpinMessage(chat.id),
    onSuccess: () => {
      qc.setQueriesData<Chat[]>({ queryKey: ['operator-chats'] }, prev =>
        prev?.map(c => c.id === chat.id ? { ...c, pinned_message_id: null } : c) ?? prev
      )
    },
    onError: () => toast.error('Не удалось открепить'),
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

  const saveColor = (key: keyof ChatColors, value: string | number | undefined) => {
    const next = { ...chatColors } as Record<string, string | number | undefined>
    if (value === undefined) delete next[key]
    else next[key] = value
    setChatColors(next as ChatColors)
    const storageKey = colorScope === 'global' ? 'chat-colors-global' : `chat-colors-${chat.id}`
    const existing: Record<string, unknown> = (() => { try { return JSON.parse(localStorage.getItem(storageKey) ?? '{}') } catch { return {} } })()
    if (value === undefined) delete existing[key]
    else existing[key] = value
    localStorage.setItem(storageKey, JSON.stringify(existing))
  }

  const handleReply = (msg: ChatMessage) => { setReplyTo(msg); setEditingMessage(null); textareaRef.current?.focus() }
  const handleEdit = (msg: ChatMessage) => {
    setEditingMessage(msg); setReplyTo(null); setText(msg.text ?? '')
    setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus(); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
    }, 0)
  }

  const highlightMessage = (messageId: number) => {
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
  }

  const handleScrollToMessage = async (messageId: number) => {
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
  }

  const exitJumpMode = async () => {
    setJumpMode(false)
    jumpTargetRef.current = null
    jumpScrolledRef.current = false
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

  const handlePin = useCallback((msg: ChatMessage) => {
    if (chat.pinned_message_id === msg.id) unpinMutation.mutate()
    else pinMutation.mutate(msg.id)
  }, [chat.pinned_message_id, pinMutation, unpinMutation])

  const handleSelectMessage = (msg: ChatMessage) => {
    if (!selectMode) setSelectMode(true)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(msg.id)) next.delete(msg.id)
      else next.add(msg.id)
      return next
    })
  }

  const handleCancelSelect = () => { setSelectMode(false); setSelectedIds(new Set()) }

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => deleteMutation.mutate(id))
    handleCancelSelect()
  }

  const handleForwardSelected = () => {
    const firstId = [...selectedIds][0]
    const msg = messages.find(m => m.id === firstId)
    if (msg) setForwardTarget(msg)
    handleCancelSelect()
  }

  const handleTranscribe = async (msg: ChatMessage, audioUrl: string) => {
    setTranscriptions(prev => new Map(prev).set(msg.id, { text: '', loading: true }))
    try {
      const { text: result } = await chatsApi.transcribeVoice(audioUrl)
      setTranscriptions(prev => new Map(prev).set(msg.id, { text: result, loading: false }))
    } catch {
      setTranscriptions(prev => { const next = new Map(prev); next.delete(msg.id); return next })
      toast.error('Не удалось распознать голосовое')
    }
  }

  const canSend = !sendMutation.isPending && !editMutation.isPending && !voice.recording && !uploadingFile
  const inputDisabled = voice.recording || uploadingFile
  const botActive = chat.bot_active
  const renderItems = buildRenderItems(displayMessages, currentUser?.id ?? -1, firstUnreadId)
  const name = chatDisplayName(chat)
  const avatarEmoji = chat.chat_type === 'cabinet' ? '📦' : chat.chat_type === 'notes' ? '📝' : '💬'
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
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 shrink-0 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mr-1 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
          </button>
        )}
        <div
          className={cn('flex items-center gap-3 flex-1 min-w-0', !searchOpen && 'cursor-pointer hover:opacity-80 transition-opacity')}
          onClick={!searchOpen ? () => { setAttachmentsOpen(true); setAttachTab('media') } : undefined}
        >
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0', avatarBg)}>
            {avatarEmoji}
          </div>
          <div className="flex-1 min-w-0">
            {searchOpen ? (
              <input autoFocus value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Поиск по сообщениям..."
                className="w-full text-sm bg-slate-100 dark:bg-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors" />
            ) : (
              <>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {botActive
                    ? <span className="text-xs text-slate-400 flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full" />Бот отвечает</span>
                    : <span className="text-xs text-blue-500 flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full" />Оператор отвечает</span>
                  }
                  {chat.operator_requested && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Ожидает оператора</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={toggleSearch} title={searchOpen ? 'Закрыть поиск' : 'Поиск'}
            className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer',
              searchOpen ? 'bg-[#1B3A72] text-white' : 'text-slate-400 hover:text-[#1B3A72] hover:bg-slate-100 dark:hover:bg-slate-800')}>
            <SearchIcon />
          </button>
          {!searchOpen && botActive && (
            <button onClick={() => takeMutation.mutate()} disabled={takeMutation.isPending}
              className="text-xs bg-[#1B3A72] text-white px-3 py-1.5 rounded-lg hover:bg-[#1B3A72]/90 transition-colors font-medium cursor-pointer">
              {takeMutation.isPending ? '...' : 'Взять чат'}
            </button>
          )}
          {!searchOpen && !botActive && (
            <button onClick={() => botMutation.mutate()} disabled={botMutation.isPending}
              className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              Вернуть боту
            </button>
          )}
          <div className="relative" ref={headerMenuRef}>
            <button onClick={() => setHeaderMenuOpen(v => !v)}
              className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer',
                headerMenuOpen ? 'bg-slate-100 dark:bg-slate-800 text-[#1B3A72]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')}>
              <DotsVerticalIcon />
            </button>
            {headerMenuOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-52 z-50">
                <HeaderMenuItem icon="📎" onClick={() => { setAttachmentsOpen(true); setHeaderMenuOpen(false) }}>Вложения чата</HeaderMenuItem>
                <HeaderMenuItem icon="🖼" onClick={() => { setAttachTab('wallpaper'); setAttachmentsOpen(true); setHeaderMenuOpen(false) }}>Обои</HeaderMenuItem>
                {!!chat.pinned_message_id && (
                  <HeaderMenuItem icon="📌" onClick={() => { if (pinnedMessage) handleScrollToMessage(pinnedMessage.id); setHeaderMenuOpen(false) }}>Перейти к закреплённому</HeaderMenuItem>
                )}
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <HeaderMenuItem icon="🗑" onClick={() => { setConfirmModal('clear'); setHeaderMenuOpen(false) }} danger>Очистить историю</HeaderMenuItem>
                <HeaderMenuItem icon="🚫" onClick={() => { setConfirmModal('delete'); setHeaderMenuOpen(false) }} danger>Удалить чат</HeaderMenuItem>
              </div>
            )}
          </div>
        </div>
      </div>

      {!!chat.pinned_message_id && !searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          onClick={() => { if (pinnedMessage) handleScrollToMessage(pinnedMessage.id) }}>
          <div className="w-0.5 h-7 bg-[#1B3A72] dark:bg-blue-400 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-[#1B3A72] dark:text-blue-400">Закреплённое сообщение</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{pinnedMessage?.text || '📎 Вложение'}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); unpinMutation.mutate() }}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs">
            ✕
          </button>
        </div>
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
        className={cn('flex-1 overflow-y-auto px-2 py-1 space-y-1 relative', isDragOver && 'ring-2 ring-inset ring-[#4A8FE7]')}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 bg-[#4A8FE7]/10 flex flex-col items-center justify-center z-20 pointer-events-none">
            <svg className="w-12 h-12 text-[#4A8FE7] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            <p className="text-[#4A8FE7] font-medium text-sm">Перетащите файлы сюда</p>
          </div>
        )}
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
            <span className="text-4xl">💬</span>
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
              pinnedMessageId={pinnedMessage?.id}
              onReply={handleReply}
              onEdit={item.isOwn ? handleEdit : undefined}
              onDelete={item.isOwn ? (msg) => deleteMutation.mutate(msg.id) : undefined}
              onForward={(msg) => setForwardTarget(msg)}
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
        {jumpMode && (
          <button
            onClick={exitJumpMode}
            className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-full px-3 py-1.5 text-xs font-medium text-[#1B3A72] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Последние ↓
          </button>
        )}
      </div>

      {botActive && !searchOpen && !selectMode && (
        <div className="border-t border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
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

      {!botActive && !searchOpen && !selectMode && (
        <>
          {stickerPickerOpen && (
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 px-3 pt-2 pb-1 shrink-0">
              <div className="flex gap-1 mb-2">
                {Object.keys(STICKERS).map(cat => (
                  <button key={cat} onClick={() => setStickerCat(cat)}
                    className={cn('text-xl p-1.5 rounded-lg transition-colors cursor-pointer', stickerCat === cat ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-9 gap-0.5 pb-1">
                {STICKERS[stickerCat].map(sticker => (
                  <button key={sticker}
                    onClick={() => { sendMutation.mutate({ t: sticker }); setStickerPickerOpen(false) }}
                    className="text-2xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors aspect-square flex items-center justify-center">
                    {sticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60">
              {pendingAttachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
                  <span>{a.mime_type.startsWith('image/') ? '🖼' : '📎'}</span>
                  <span className="max-w-32 truncate">{a.name}</span>
                  <button onClick={() => setPendingAttachments((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer">✕</button>
                </div>
              ))}
            </div>
          )}

          {(replyTo || editingMessage) && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60">
              <div className={cn('w-0.5 h-8 rounded-full shrink-0', editingMessage ? 'bg-amber-400' : 'bg-[#4A8FE7]')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {editingMessage ? 'Редактирование' : `Ответ: ${replyTo!.sender_name}`}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                  {editingMessage ? (editingMessage.text ?? '') : (replyTo!.text || (replyTo!.attachments?.length ? '📎 Вложение' : ''))}
                </p>
              </div>
              <button onClick={cancelContext} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0 p-1 cursor-pointer">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 shrink-0">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov" />

            {voice.recording ? (
              <>
                <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-2xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Запись... {voice.seconds}с
                  <button onClick={voice.cancel} className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">Отмена</button>
                </div>
                <button onClick={voice.stop} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shrink-0 cursor-pointer"><SendIcon /></button>
              </>
            ) : (
              <>
                <button onClick={() => fileInputRef.current?.click()} disabled={!canSend || uploadingFile}
                  className="w-9 h-9 rounded-full text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 cursor-pointer">
                  {uploadingFile ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <PaperclipIcon />}
                </button>
                <button
                  onClick={() => setStickerPickerOpen(v => !v)}
                  className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer',
                    stickerPickerOpen ? 'bg-[#1B3A72] text-white' : 'text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
                  <StickerIcon />
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={inputDisabled}
                  placeholder={editingMessage ? 'Редактировать сообщение...' : 'Сообщение'}
                  rows={1}
                  className="flex-1 resize-none bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors max-h-32 overflow-y-auto leading-relaxed disabled:opacity-50"
                  onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px' }}
                />
                {text.trim() || pendingAttachments.length > 0 || editingMessage ? (
                  <button onClick={handleSend} disabled={!canSend}
                    className="w-10 h-10 rounded-full bg-[#1B3A72] flex items-center justify-center text-white hover:bg-[#1B3A72]/90 disabled:opacity-40 transition-all shrink-0 cursor-pointer">
                    <SendIcon />
                  </button>
                ) : (
                  <button onClick={voice.start}
                    className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-all shrink-0 cursor-pointer">
                    <MicIcon />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {forwardTarget && (
        <ForwardDialog message={forwardTarget} currentChatId={chat.id} onClose={() => setForwardTarget(null)} />
      )}

      {attachmentsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setAttachmentsOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-lg mx-4 max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Информация о чате</h3>
              <button onClick={() => setAttachmentsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer text-lg leading-none">✕</button>
            </div>
            <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
              <div className={cn('w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0', avatarBg)}>
                {avatarEmoji}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-base truncate">{name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {botActive ? '🤖 Бот отвечает' : '👤 Оператор отвечает'}
                </p>
              </div>
            </div>
            <div className="flex gap-1 px-4 py-2 border-b border-slate-100 dark:border-slate-700/60 shrink-0 flex-wrap">
              {(['media', 'files', 'voice', 'colors', 'wallpaper'] as const).map(tab => {
                const labels: Record<string, string> = {
                  media: `Медиа (${allAttachments.media.length})`,
                  files: `Файлы (${allAttachments.files.length})`,
                  voice: `Голосовые (${allAttachments.voices.length})`,
                  colors: 'Цвета',
                  wallpaper: 'Обои',
                }
                return (
                  <button key={tab} onClick={() => setAttachTab(tab)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer', attachTab === tab ? 'bg-[#1B3A72] text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
                    {labels[tab]}
                  </button>
                )
              })}
            </div>
            <div className="flex-1 overflow-y-auto">
              {attachTab === 'media' && (
                allAttachments.media.length === 0
                  ? <EmptyAttach label="Нет медиафайлов" />
                  : <div className="grid grid-cols-3 gap-0.5 p-0.5">
                    {allAttachments.media.map((item, i) => {
                      const fullUrl = toFullUrl(item.url)
                      return (
                        <div key={i} className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative group cursor-pointer"
                          onClick={() => {
                            if (item.mime.startsWith('image/')) setLightbox({ url: fullUrl, name: '' })
                            else { setAttachmentsOpen(false); setTimeout(() => handleScrollToMessage(item.message_id), 100) }
                          }}
                          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, messageId: item.message_id }) }}>
                          {item.mime.startsWith('image/')
                            ? <img src={fullUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                          }
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                        </div>
                      )
                    })}
                  </div>
              )}
              {attachTab === 'files' && (
                allAttachments.files.length === 0
                  ? <EmptyAttach label="Нет файлов" />
                  : <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {allAttachments.files.map((item, i) => {
                      const fullUrl = toFullUrl(item.url)
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, messageId: item.message_id }) }}>
                          <span className="text-2xl shrink-0">{fileIcon(item.mime)}</span>
                          <div className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => window.open(fullUrl, '_blank')}>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {item.size > 0 ? `${(item.size / 1024).toFixed(0)} КБ` : ''}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <a href={fullUrl} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-colors"
                              title="Открыть">
                              <OpenExtIcon />
                            </a>
                            <button onClick={e => { e.stopPropagation(); downloadBlob(fullUrl, item.name) }}
                              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-colors cursor-pointer"
                              title="Скачать">
                              <DownloadSmIcon />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
              )}
              {attachTab === 'voice' && (
                allAttachments.voices.length === 0
                  ? <EmptyAttach label="Нет голосовых сообщений" />
                  : <div className="divide-y divide-slate-100 dark:divide-slate-700/60 px-4 py-1">
                    {allAttachments.voices.map((item, i) => (
                      <div key={i} className="py-2.5"
                        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, messageId: item.message_id }) }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs text-slate-400">
                            🎙 {item.duration != null ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : 'Голосовое'}
                          </p>
                          <button
                            onClick={() => { setAttachmentsOpen(false); setTimeout(() => handleScrollToMessage(item.message_id), 100) }}
                            className="text-[10px] font-medium text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer">
                            В чат ↗
                          </button>
                        </div>
                        <audio controls src={toFullUrl(item.url)} className="w-full h-8" />
                      </div>
                    ))}
                  </div>
              )}
              {attachTab === 'colors' && (
                <div className="p-4 space-y-5">
                  <div className="flex gap-2">
                    <button onClick={() => setColorScope('chat')}
                      className={cn('flex-1 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer', colorScope === 'chat' ? 'bg-[#1B3A72] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                      Этот чат
                    </button>
                    <button onClick={() => setColorScope('global')}
                      className={cn('flex-1 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer', colorScope === 'global' ? 'bg-[#1B3A72] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                      Все чаты
                    </button>
                  </div>
                  <ColorSection
                    title="Мои сообщения"
                    value={chatColors.ownBubble}
                    onChange={(v) => saveColor('ownBubble', v)}
                    colors={['#1B3A72', '#1d4ed8', '#7c3aed', '#db2777', '#059669', '#0891b2', '#374151', '#dc2626']}
                  />
                  <ColorSection
                    title="Сообщения собеседника"
                    value={chatColors.otherBubble}
                    onChange={(v) => saveColor('otherBubble', v)}
                    colors={['#f1f5f9', '#fef3c7', '#d1fae5', '#e0e7ff', '#fce7f3', '#f0fdf4', '#fff7ed', '#fdf2f8']}
                  />
                  <ColorSection
                    title="Сообщения бота"
                    value={chatColors.botBubble}
                    onChange={(v) => saveColor('botBubble', v)}
                    colors={['#eef2ff', '#e0e7ff', '#ede9fe', '#fce7f3', '#dcfce7', '#cffafe', '#fef9c3', '#fee2e2']}
                  />
                  <ColorSection
                    title="Текст моих сообщений"
                    value={chatColors.ownText}
                    onChange={(v) => saveColor('ownText', v)}
                    colors={['#ffffff', '#f0f9ff', '#fef9c3', '#dcfce7', '#ffe4e6', '#f3e8ff', '#ffedd5', '#e0f2fe']}
                  />
                  <ColorSection
                    title="Текст собеседника"
                    value={chatColors.otherText}
                    onChange={(v) => saveColor('otherText', v)}
                    colors={['#1e293b', '#1e3a5f', '#3b0764', '#831843', '#14532d', '#164e63', '#713f12', '#7f1d1d']}
                  />
                  <ColorSection
                    title="Текст бота"
                    value={chatColors.botText}
                    onChange={(v) => saveColor('botText', v)}
                    colors={['#1e293b', '#3730a3', '#1e40af', '#5b21b6', '#065f46', '#0e7490', '#92400e', '#991b1b']}
                  />
                  <ColorSection
                    title="Цвет никнеймов"
                    value={chatColors.nickColor}
                    onChange={(v) => saveColor('nickColor', v)}
                    colors={['#1B3A72', '#2563eb', '#7c3aed', '#be185d', '#065f46', '#0e7490', '#92400e', '#dc2626']}
                  />
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Размер шрифта</p>
                    <div className="flex items-center gap-2">
                      {([12, 13, 14, 15, 16, 18] as const).map(size => (
                        <button
                          key={size}
                          onClick={() => saveColor('fontSize', chatColors.fontSize === size ? undefined : size)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border',
                            chatColors.fontSize === size
                              ? 'bg-[#1B3A72] text-white border-transparent'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                          )}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {attachTab === 'wallpaper' && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {WALLPAPERS.map(wp => (
                      <button key={wp.id}
                        onClick={() => {
                          setWallpaper(wp.id)
                          setCustomWallpaperUrl(null)
                          localStorage.setItem(`chat-wallpaper-${chat.id}`, wp.id)
                          localStorage.removeItem(`chat-wallpaper-custom-${chat.id}`)
                          chatsApi.setWallpaper(chat.id, wp.id).catch(() => {})
                        }}
                        className={cn('h-20 rounded-xl border-2 flex items-end justify-center pb-2 transition-all cursor-pointer overflow-hidden', wallpaper === wp.id && !customWallpaperUrl ? 'border-[#1B3A72] scale-95 shadow-md' : 'border-transparent hover:scale-95')}
                        style={{ background: isDarkMode ? wp.dark : wp.light }}>
                        <span className="text-[10px] font-semibold text-white drop-shadow px-1.5 py-0.5 rounded-full bg-black/25">{wp.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Своё изображение</p>
                    <div className="flex items-center gap-2">
                      <label className={cn('flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-[#1B3A72] hover:text-[#1B3A72] dark:hover:border-blue-400 dark:hover:text-blue-400 cursor-pointer transition-colors', uploadingWallpaper && 'opacity-50 pointer-events-none')}>
                        {uploadingWallpaper ? (
                          <div className="w-4 h-4 border-2 border-[#1B3A72] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                        )}
                        {uploadingWallpaper ? 'Загрузка...' : 'Загрузить'}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          e.target.value = ''
                          setUploadingWallpaper(true)
                          try {
                            const { url } = await chatsApi.uploadAttachment(file)
                            const fullUrl = toFullUrl(url)
                            setCustomWallpaperUrl(fullUrl)
                            setWallpaper('custom')
                            localStorage.setItem(`chat-wallpaper-${chat.id}`, 'custom')
                            localStorage.setItem(`chat-wallpaper-custom-${chat.id}`, fullUrl)
                            chatsApi.setWallpaper(chat.id, 'custom', fullUrl).catch(() => {})
                          } catch {
                            toast.error('Не удалось загрузить изображение')
                          } finally {
                            setUploadingWallpaper(false)
                          }
                        }} />
                      </label>
                      {customWallpaperUrl && (
                        <>
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 border-[#1B3A72]">
                            <img src={customWallpaperUrl} alt="Custom" className="w-full h-full object-cover" />
                          </div>
                          <button
                            onClick={() => {
                              setCustomWallpaperUrl(null)
                              setWallpaper('default')
                              localStorage.removeItem(`chat-wallpaper-custom-${chat.id}`)
                              localStorage.setItem(`chat-wallpaper-${chat.id}`, 'default')
                              chatsApi.setWallpaper(chat.id, 'default').catch(() => {})
                            }}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer text-sm">
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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

      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfirmModal(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-2">
              {confirmModal === 'clear' ? 'Очистить историю?' : 'Удалить чат?'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              {confirmModal === 'clear' ? 'Все сообщения будут удалены без возможности восстановления.' : 'Чат и вся история будут удалены навсегда.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                Отмена
              </button>
              <button
                onClick={confirmModal === 'clear' ? () => clearMutation.mutate() : () => deleteChatMutation.mutate()}
                disabled={clearMutation.isPending || deleteChatMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors cursor-pointer">
                {clearMutation.isPending || deleteChatMutation.isPending ? '...' : confirmModal === 'clear' ? 'Очистить' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ForwardDialog({ message, currentChatId, onClose }: { message: ChatMessage; currentChatId: number; onClose: () => void }) {
  const qc = useQueryClient()
  const [sending, setSending] = useState(false)
  const chats = (qc.getQueryData<Chat[]>(['operator-chats']) ?? []).filter((c) => c.id !== currentChatId)

  const forward = async (chatId: number) => {
    setSending(true)
    try {
      const msg = await chatsApi.sendMessage(chatId, message.text ?? '', message.attachments?.length ? message.attachments : undefined)
      qc.setQueryData<Chat[]>(['operator-chats'], (prev) =>
        prev?.map((c) => c.id === chatId ? { ...c, last_message_text: msg.text || msg.attachments?.[0]?.file_name || c.last_message_text, last_message_at: msg.created_at } : c) ?? []
      )
      toast.success('Сообщение переслано')
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
          <p className="font-semibold text-slate-800 dark:text-slate-100">Переслать в чат</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 py-1">
          {chats.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Нет других чатов</p>}
          {chats.map((c) => (
            <button key={c.id} disabled={sending} onClick={() => forward(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50 cursor-pointer">
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0', c.chat_type === 'cabinet' ? 'bg-[#1B3A72] text-white' : 'bg-slate-400 text-white')}>
                {c.chat_type === 'cabinet' ? '📦' : c.chat_type === 'notes' ? '📝' : '💬'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{chatDisplayName(c)}</p>
                {c.last_message_text && <p className="text-xs text-slate-400 truncate">{c.last_message_text}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyAttach({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
      <span className="text-3xl">📭</span>
      {label}
    </div>
  )
}

function ColorSection({ title, value, onChange, colors }: {
  title: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  colors: string[]
}) {
  const isCustom = value !== undefined && !colors.includes(value)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{title}</p>
      
      <div className="flex flex-wrap gap-2 items-center">
        {/* По умолчанию */}
        <button
          onClick={() => onChange(undefined)}
          title="По умолчанию"
          className={cn(
            'w-8 h-8 rounded-lg border-2 text-xs font-bold flex items-center justify-center transition-all cursor-pointer shrink-0',
            !value ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 ring-2 ring-[#1B3A72]/20' : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-slate-400'
          )}
        >✕</button>

        {/* Пресеты */}
        {colors.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              'w-8 h-8 rounded-lg border-2 transition-all cursor-pointer shrink-0',
              value === c ? 'border-[#1B3A72] scale-110 shadow-md ring-2 ring-[#1B3A72]/20' : 'border-transparent hover:scale-105 hover:shadow-sm'
            )}
            style={{ backgroundColor: c }}
          />
        ))}

        {/* Активный кастомный цвет (если не в списке) */}
        {isCustom && (
          <button
            onClick={() => inputRef.current?.click()}
            title={value}
            className="w-8 h-8 rounded-lg border-2 border-[#1B3A72] scale-110 shadow-md ring-2 ring-[#1B3A72]/20 transition-all shrink-0 cursor-pointer"
            style={{ backgroundColor: value }}
          />
        )}

        {/* Кнопка «+» с нативным color picker */}
        <label
          className={cn(
            'w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 relative overflow-hidden',
            isCustom
              ? 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
              : 'border-dashed border-slate-400 dark:border-slate-500 hover:border-[#1B3A72] dark:hover:border-blue-400'
          )}
        >
          <input
            ref={inputRef}
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
          />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 select-none">+</span>
        </label>
      </div>

      {/* Текстовый ввод HEX для кастомного цвета */}
      {isCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const hex = e.target.value
              if (/^#[0-9A-Fa-f]{6}$/.test(hex)) onChange(hex)
            }}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-24 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#1B3A72]/20"
            maxLength={7}
            placeholder="#000000"
          />
          <span className="text-[10px] text-slate-400 font-medium">HEX</span>
        </div>
      )}
    </div>
  )
}

function HeaderMenuItem({ icon, onClick, danger, children }: { icon: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer',
        danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
      <span className="text-base">{icon}</span>
      {children}
    </button>
  )
}

const BOT_NAMES = new Set(['Ася', 'Bot', 'bot', 'Asya'])

type RenderItem =
  | { type: 'date'; date: Date }
  | { type: 'unread-divider' }
  | { type: 'message'; message: ChatMessage; isOwn: boolean; isBot: boolean; showAvatar: boolean; showName: boolean; isLastInGroup: boolean }

function buildRenderItems(messages: ChatMessage[], myId: number, firstUnreadId?: number): RenderItem[] {
  const items: RenderItem[] = []
  let lastDate: string | null = null
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1] ?? null
    const next = messages[i + 1] ?? null
    const msgDate = new Date(msg.created_at).toDateString()
    if (firstUnreadId && msg.id === firstUnreadId) items.push({ type: 'unread-divider' })
    if (msgDate !== lastDate) { items.push({ type: 'date', date: new Date(msg.created_at) }); lastDate = msgDate }
    const isOwn = msg.sender_id === myId
    const isBot = !isOwn && BOT_NAMES.has(msg.sender_name ?? '')
    const sameAsPrev = !!(prev && prev.sender_id === msg.sender_id && new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS)
    const sameAsNext = !!(next && next.sender_id === msg.sender_id && new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() < GROUP_GAP_MS)
    items.push({ type: 'message', message: msg, isOwn, isBot, showAvatar: !isOwn && !isBot && !sameAsNext, showName: !isOwn && !isBot && !sameAsPrev, isLastInGroup: !sameAsNext })
  }
  return items
}

function SearchIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
function SendIcon() {
  return <svg className="w-5 h-5 translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
}
function PaperclipIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
}
function MicIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
}
function DotsVerticalIcon() {
  return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
}
function ForwardIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>
}
function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
function StickerIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm5.25 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c4.97 0 9 4.03 9 9 0 1.657-.448 3.207-1.232 4.539L12 21l-7.768-4.461A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9z" /></svg>
}
function OpenExtIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
}
function DownloadSmIcon() {
  return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
}
function fileIcon(mime: string): string {
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('doc')) return '📝'
  if (mime.includes('excel') || mime.includes('sheet') || mime.includes('xls')) return '📊'
  if (mime.includes('video')) return '🎬'
  if (mime.includes('zip') || mime.includes('archive')) return '🗜'
  return '📎'
}
