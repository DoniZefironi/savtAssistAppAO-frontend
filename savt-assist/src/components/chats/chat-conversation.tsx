'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

  // Гарантируем что currentUser всегда заполнен (фикс для left/right)
  useEffect(() => {
    if (!currentUser) {
      authApi.me().then(setUser).catch(() => {})
    }
  }, [currentUser, setUser])
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<(MessageAttachment & { name: string })[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', chat.id],
    queryFn: () => chatsApi.getMessages(chat.id),
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (messages.length > 0) onMessagesLoaded?.()
  }, [messages.length])

  // Mark read on open
  useEffect(() => {
    if (chat.unread_count > 0) {
      chatsApi.markRead(chat.id).catch(() => {})
      qc.invalidateQueries({ queryKey: ['operator-chats'] })
    }
  }, [chat.id])

  // Scroll to bottom
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])
  useEffect(() => { setTimeout(() => bottomRef.current?.scrollIntoView(), 60) }, [chat.id])

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: ({ t, attachments }: { t: string; attachments?: MessageAttachment[] }) =>
      chatsApi.sendMessage(chat.id, t, attachments),
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(['messages', chat.id], (prev) => [msg, ...(prev ?? [])])
      setText('')
      setPendingAttachments([])
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    },
    onError: () => toast.error('Не удалось отправить'),
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

  // ── Voice ─────────────────────────────────────────────────────────────────────
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

  // ── File upload ───────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
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
      toast.error('Не удалось загрузить файл')
    } finally {
      setUploadingFile(false)
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const t = text.trim()
    if (!t && pendingAttachments.length === 0) return
    sendMutation.mutate({ t, attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const canSend = !sendMutation.isPending && !voice.recording && !uploadingFile
  // Textarea никогда не блокируется отправкой — только записью голоса или загрузкой файла
  const inputDisabled = voice.recording || uploadingFile
  const botActive = chat.bot_active

  // ── Render ────────────────────────────────────────────────────────────────────
  const displayMessages = [...messages].reverse()
  const renderItems = buildRenderItems(displayMessages, currentUser?.id ?? -1)
  const name = chatDisplayName(chat)
  const avatarEmoji = chat.chat_type === 'cabinet' ? '📦' : chat.chat_type === 'notes' ? '📝' : '💬'
  const avatarBg = chat.chat_type === 'cabinet' ? 'bg-[#1B3A72]' : 'bg-slate-500'

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="md:hidden text-slate-500 hover:text-slate-700 mr-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}

        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0', avatarBg)}>
          {avatarEmoji}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm truncate">{name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {botActive ? (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full" />
                Бот отвечает
              </span>
            ) : (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Оператор отвечает
              </span>
            )}
            {chat.operator_requested && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                Ожидает оператора
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {botActive && (
            <button
              onClick={() => takeMutation.mutate()}
              disabled={takeMutation.isPending}
              className="text-xs bg-[#1B3A72] text-white px-3 py-1.5 rounded-lg hover:bg-[#1B3A72]/90 transition-colors font-medium"
            >
              {takeMutation.isPending ? '...' : 'Взять чат'}
            </button>
          )}
          {!botActive && (
            <button
              onClick={() => botMutation.mutate()}
              disabled={botMutation.isPending}
              className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Вернуть боту
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1"
        style={{ background: 'linear-gradient(160deg, #f5f7fa 0%, #eaeff8 100%)' }}
      >
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
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Bot active banner (replaces input) ──────────────────────────────────── */}
      {botActive && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Сейчас отвечает бот</p>
              <p className="text-xs text-amber-600 mt-0.5">Чтобы ответить самостоятельно — возьмите чат</p>
            </div>
            <button
              onClick={() => takeMutation.mutate()}
              disabled={takeMutation.isPending}
              className="bg-[#1B3A72] text-white text-sm px-4 py-2 rounded-xl hover:bg-[#1B3A72]/90 transition-colors font-medium flex-shrink-0"
            >
              {takeMutation.isPending ? 'Загрузка...' : 'Взять чат'}
            </button>
          </div>
        </div>
      )}

      {/* ── Input (only when bot is NOT active) ────────────────────────────────── */}
      {!botActive && (
        <>
          {/* Pending attachments */}
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 py-2 bg-white border-t border-slate-100">
              {pendingAttachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1 text-xs text-slate-700">
                  <span>{a.mime_type.startsWith('image/') ? '🖼' : '📎'}</span>
                  <span className="max-w-32 truncate">{a.name}</span>
                  <button onClick={() => setPendingAttachments((p) => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 ml-1">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-3 bg-white border-t border-slate-200 flex-shrink-0">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov" />

            {voice.recording ? (
              <>
                <div className="flex-1 flex items-center gap-3 bg-red-50 rounded-2xl px-4 py-2.5 text-sm text-red-600">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Запись... {voice.seconds}с
                  <button onClick={voice.cancel} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Отмена</button>
                </div>
                <button onClick={voice.stop} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 flex-shrink-0">
                  <SendIcon />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canSend || uploadingFile}
                  className="w-9 h-9 rounded-full text-slate-400 hover:text-[#1B3A72] hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-40"
                  title="Прикрепить файл"
                >
                  {uploadingFile
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <PaperclipIcon />
                  }
                </button>

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={inputDisabled}
                  placeholder="Сообщение"
                  rows={1}
                  className="flex-1 resize-none bg-slate-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:bg-slate-200 transition-colors max-h-32 overflow-y-auto leading-relaxed disabled:opacity-50"
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px'
                  }}
                />

            {/* Send or mic */}
            {text.trim() || pendingAttachments.length > 0 ? (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="w-10 h-10 rounded-full bg-[#1B3A72] flex items-center justify-center text-white hover:bg-[#1B3A72]/90 disabled:opacity-40 transition-all flex-shrink-0"
              >
                <SendIcon />
              </button>
            ) : (
              <button
                onClick={voice.start}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#1B3A72] hover:text-white transition-all flex-shrink-0"
                title="Голосовое сообщение"
              >
                <MicIcon />
              </button>
            )}
          </>
        )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
