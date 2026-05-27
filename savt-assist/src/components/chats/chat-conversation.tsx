'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { MessageBubble, DateSeparator } from './message-bubble'
import { chatDisplayName } from './chat-list-panel'
import { chatsApi } from '@/lib/api/chats'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'
import { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'
import type { Chat, ChatMessage, MessageAttachment } from '@/types'

const GROUP_GAP_MS = 5 * 60 * 1000

interface Props {
  chat: Chat
  onBack?: () => void
  onMessagesLoaded?: () => void
}

export function ChatConversation({ chat, onBack, onMessagesLoaded }: Props) {
  const qc = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!currentUser) authApi.me().then(setUser).catch(() => {})
  }, [currentUser, setUser])

  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<(MessageAttachment & { name: string })[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null)
  const [forwardTarget, setForwardTarget] = useState<ChatMessage | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', chat.id],
    queryFn: () => chatsApi.getMessages(chat.id),
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (messages.length > 0) onMessagesLoaded?.()
  }, [messages.length])

  useEffect(() => {
    if (chat.unread_count > 0) {
      chatsApi.markRead(chat.id).catch(() => {})
      qc.invalidateQueries({ queryKey: ['operator-chats'] })
    }
  }, [chat.id])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView(), 60) }, [chat.id])

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  const sendMutation = useMutation({
    mutationFn: ({ t, attachments, replyToId }: { t: string; attachments?: MessageAttachment[]; replyToId?: number }) =>
      chatsApi.sendMessage(chat.id, t, attachments, replyToId),
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(['messages', chat.id], (prev) => [msg, ...(prev ?? [])])
      qc.setQueryData<Chat[]>(['operator-chats'], (prev) =>
        prev?.map((c) =>
          c.id === chat.id
            ? { ...c, last_message_text: msg.text || msg.attachments?.[0]?.file_name || c.last_message_text, last_message_at: msg.created_at }
            : c
        ) ?? []
      )
      setText('')
      setPendingAttachments([])
      setReplyTo(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    },
    onError: () => toast.error('Не удалось отправить'),
  })

  const editMutation = useMutation({
    mutationFn: ({ messageId, newText }: { messageId: number; newText: string }) =>
      chatsApi.editMessage(chat.id, messageId, newText),
    onSuccess: (updated) => {
      qc.setQueryData<ChatMessage[]>(['messages', chat.id], (prev) =>
        prev?.map((m) => m.id === updated.id ? updated : m) ?? []
      )
      setText('')
      setEditingMessage(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    },
    onError: () => toast.error('Не удалось изменить сообщение'),
  })

  const deleteMutation = useMutation({
    mutationFn: (messageId: number) => chatsApi.deleteMessage(chat.id, messageId),
    onSuccess: (_, messageId) => {
      qc.setQueryData<ChatMessage[]>(['messages', chat.id], (prev) =>
        prev?.map((m) => m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m) ?? []
      )
      qc.setQueryData<Chat[]>(['operator-chats'], (prev) => {
        if (!prev) return prev
        const msgs = qc.getQueryData<ChatMessage[]>(['messages', chat.id]) ?? []
        const latest = msgs.find((m) => !m.deleted_at)
        return prev.map((c) =>
          c.id === chat.id
            ? { ...c, last_message_text: latest?.text ?? null, last_message_at: latest?.created_at ?? c.last_message_at }
            : c
        )
      })
    },
    onError: () => toast.error('Не удалось удалить сообщение'),
  })

  const takeMutation = useMutation({
    mutationFn: () => chatsApi.takeChat(chat.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-chats'] })
      toast.success('Чат взят — теперь вы можете отвечать')
    },
    onError: () => toast.error('Не удалось взять чат'),
  })

  const botMutation = useMutation({
    mutationFn: () => chatsApi.returnToBot(chat.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-chats'] })
      toast.success('Чат передан боту')
    },
  })

  const handleVoiceFinish = useCallback(async (blob: Blob, duration: number) => {
    try {
      const { url } = await chatsApi.uploadVoice(blob)
      sendMutation.mutate({
        t: '',
        attachments: [{
          file_url: url,
          file_name: 'Голосовое сообщение',
          file_size_bytes: blob.size,
          mime_type: blob.type || 'audio/ogg',
          duration_seconds: duration,
        }],
      })
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
        setPendingAttachments((prev) => [...prev, {
          file_url: url,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          name: file.name,
          duration_seconds: null,
        }])
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
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files)
  }

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

  const handleReply = (msg: ChatMessage) => {
    setReplyTo(msg); setEditingMessage(null); textareaRef.current?.focus()
  }

  const handleEdit = (msg: ChatMessage) => {
    setEditingMessage(msg); setReplyTo(null); setText(msg.text ?? '')
    setTimeout(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus(); ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 128) + 'px'
    }, 0)
  }

  const handleScrollToMessage = (messageId: number) => {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.style.transition = 'background-color 0.3s ease'
    el.style.backgroundColor = 'rgba(74, 143, 231, 0.2)'
    setTimeout(() => { el.style.backgroundColor = '' }, 1500)
  }

  const canSend = !sendMutation.isPending && !editMutation.isPending && !voice.recording && !uploadingFile
  const inputDisabled = voice.recording || uploadingFile
  const botActive = chat.bot_active

  const displayMessages = [...messages].reverse()
  const renderItems = buildRenderItems(displayMessages, currentUser?.id ?? -1)
  const name = chatDisplayName(chat)
  const avatarEmoji = chat.chat_type === 'cabinet' ? '📦' : chat.chat_type === 'notes' ? '📝' : '💬'
  const avatarBg = chat.chat_type === 'cabinet' ? 'bg-[#1B3A72]' : 'bg-slate-500'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 flex-shrink-0 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mr-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0', avatarBg)}>
          {avatarEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {botActive ? (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full" />Бот отвечает
              </span>
            ) : (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full" />Оператор отвечает
              </span>
            )}
            {chat.operator_requested && (
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Ожидает оператора</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {botActive && (
            <button onClick={() => takeMutation.mutate()} disabled={takeMutation.isPending}
              className="text-xs bg-[#1B3A72] text-white px-3 py-1.5 rounded-lg hover:bg-[#1B3A72]/90 transition-colors font-medium">
              {takeMutation.isPending ? '...' : 'Взять чат'}
            </button>
          )}
          {!botActive && (
            <button onClick={() => botMutation.mutate()} disabled={botMutation.isPending}
              className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Вернуть боту
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className={cn('flex-1 overflow-y-auto px-4 py-3 space-y-1 relative bg-[linear-gradient(160deg,#f5f7fa_0%,#eaeff8_100%)] dark:bg-slate-800', isDragOver && 'ring-2 ring-inset ring-[#4A8FE7]')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="absolute inset-0 bg-[#4A8FE7]/10 flex flex-col items-center justify-center z-20 pointer-events-none">
            <svg className="w-12 h-12 text-[#4A8FE7] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-[#4A8FE7] font-medium text-sm">Перетащите файлы сюда</p>
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
            <p className="text-sm">Нет сообщений</p>
          </div>
        )}
        {renderItems.map((item, i) =>
          item.type === 'date' ? (
            <DateSeparator key={`d-${i}`} date={item.date} />
          ) : (
            <MessageBubble
              key={item.message.id}
              message={item.message}
              isOwn={item.isOwn}
              showAvatar={item.showAvatar}
              showName={item.showName}
              isLastInGroup={item.isLastInGroup}
              messagesById={messagesById}
              onReply={handleReply}
              onEdit={item.isOwn ? handleEdit : undefined}
              onDelete={item.isOwn ? (msg) => deleteMutation.mutate(msg.id) : undefined}
              onForward={(msg) => setForwardTarget(msg)}
              onScrollToMessage={handleScrollToMessage}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {botActive && (
        <div className="border-t border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Сейчас отвечает бот</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Чтобы ответить самостоятельно — возьмите чат</p>
            </div>
            <button onClick={() => takeMutation.mutate()} disabled={takeMutation.isPending}
              className="bg-[#1B3A72] text-white text-sm px-4 py-2 rounded-xl hover:bg-[#1B3A72]/90 transition-colors font-medium flex-shrink-0">
              {takeMutation.isPending ? 'Загрузка...' : 'Взять чат'}
            </button>
          </div>
        </div>
      )}

      {!botActive && (
        <>
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60">
              {pendingAttachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
                  <span>{a.mime_type.startsWith('image/') ? '🖼' : '📎'}</span>
                  <span className="max-w-32 truncate">{a.name}</span>
                  <button onClick={() => setPendingAttachments((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-1">✕</button>
                </div>
              ))}
            </div>
          )}

          {(replyTo || editingMessage) && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60">
              <div className={cn('w-0.5 h-8 rounded-full flex-shrink-0', editingMessage ? 'bg-amber-400' : 'bg-[#4A8FE7]')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {editingMessage ? 'Редактирование' : `Ответ: ${replyTo!.sender_name}`}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                  {editingMessage
                    ? (editingMessage.text ?? '')
                    : (replyTo!.text || (replyTo!.attachments?.length ? '📎 Вложение' : ''))}
                </p>
              </div>
              <button onClick={cancelContext} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0 p-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 flex-shrink-0">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} multiple
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov" />

            {voice.recording ? (
              <>
                <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-2xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Запись... {voice.seconds}с
                  <button onClick={voice.cancel} className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Отмена</button>
                </div>
                <button onClick={voice.stop} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 flex-shrink-0">
                  <SendIcon />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => fileInputRef.current?.click()} disabled={!canSend || uploadingFile}
                  className="w-9 h-9 rounded-full text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40"
                  title="Прикрепить файл">
                  {uploadingFile
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <PaperclipIcon />}
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
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px'
                  }}
                />

                {text.trim() || pendingAttachments.length > 0 || editingMessage ? (
                  <button onClick={handleSend} disabled={!canSend}
                    className="w-10 h-10 rounded-full bg-[#1B3A72] flex items-center justify-center text-white hover:bg-[#1B3A72]/90 disabled:opacity-40 transition-all flex-shrink-0">
                    <SendIcon />
                  </button>
                ) : (
                  <button onClick={voice.start}
                    className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-all flex-shrink-0"
                    title="Голосовое сообщение">
                    <MicIcon />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

      {forwardTarget && (
        <ForwardDialog
          message={forwardTarget}
          currentChatId={chat.id}
          onClose={() => setForwardTarget(null)}
        />
      )}
    </div>
  )
}

function ForwardDialog({ message, currentChatId, onClose }: {
  message: ChatMessage
  currentChatId: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [sending, setSending] = useState(false)
  const chats = (qc.getQueryData<Chat[]>(['operator-chats']) ?? []).filter((c) => c.id !== currentChatId && !c.bot_active)

  const forward = async (chatId: number) => {
    setSending(true)
    try {
      const msg = await chatsApi.sendMessage(chatId, message.text ?? '', message.attachments?.length ? message.attachments : undefined)
      qc.setQueryData<Chat[]>(['operator-chats'], (prev) =>
        prev?.map((c) =>
          c.id === chatId
            ? { ...c, last_message_text: msg.text || msg.attachments?.[0]?.file_name || c.last_message_text, last_message_at: msg.created_at }
            : c
        ) ?? []
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
      <div
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 mb-4 sm:mb-0 max-h-[60vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Переслать в чат</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 py-1">
          {chats.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Нет других чатов</p>
          )}
          {chats.map((c) => (
            <button key={c.id} disabled={sending} onClick={() => forward(c.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left disabled:opacity-50">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0',
                c.chat_type === 'cabinet' ? 'bg-[#1B3A72] text-white' : 'bg-slate-400 text-white'
              )}>
                {c.chat_type === 'cabinet' ? '📦' : c.chat_type === 'notes' ? '📝' : '💬'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{chatDisplayName(c)}</p>
                {c.last_message_text && (
                  <p className="text-xs text-slate-400 truncate">{c.last_message_text}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}


type RenderItem =
  | { type: 'date'; date: Date }
  | { type: 'message'; message: ChatMessage; isOwn: boolean; showAvatar: boolean; showName: boolean; isLastInGroup: boolean }

function buildRenderItems(messages: ChatMessage[], myId: number): RenderItem[] {
  const items: RenderItem[] = []
  let lastDate: string | null = null

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1] ?? null
    const next = messages[i + 1] ?? null

    const msgDate = new Date(msg.created_at).toDateString()
    if (msgDate !== lastDate) {
      items.push({ type: 'date', date: new Date(msg.created_at) })
      lastDate = msgDate
    }

    const isOwn = msg.sender_id === myId
    const sameAsPrev = !!(prev && prev.sender_id === msg.sender_id &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP_MS)
    const sameAsNext = !!(next && next.sender_id === msg.sender_id &&
      new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() < GROUP_GAP_MS)

    items.push({
      type: 'message', message: msg, isOwn,
      showAvatar: !isOwn && !sameAsNext,
      showName: !isOwn && !sameAsPrev,
      isLastInGroup: !sameAsNext,
    })
  }
  return items
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
