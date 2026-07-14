'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Bot, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AttachmentView } from './attachment-view'
import type { ChatMessage } from '@/types'

const QUICK_EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🔥', '🎉']

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#1e293b' : '#ffffff'
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

interface Props {
  message: ChatMessage
  isOwn: boolean
  isBot?: boolean
  showAvatar: boolean
  showName: boolean
  isLastInGroup: boolean
  messagesById?: Map<number, ChatMessage>
  currentUserId?: number
  pinnedMessageIds?: Set<number>
  onReply?: (msg: ChatMessage) => void
  onEdit?: (msg: ChatMessage) => void
  onDelete?: (msg: ChatMessage) => void
  onForward?: (msg: ChatMessage) => void
  onReact?: (msg: ChatMessage, emoji: string) => void
  onScrollToMessage?: (id: number) => void
  onPin?: (msg: ChatMessage) => void
  onSelect?: (msg: ChatMessage) => void
  isSelected?: boolean
  selectMode?: boolean
  transcription?: string
  transcribing?: boolean
  onTranscribe?: (msg: ChatMessage, url: string) => void
  ownBubbleColor?: string
  otherBubbleColor?: string
  botBubbleColor?: string
  nickColor?: string
  fontSize?: number
  ownTextColor?: string
  otherTextColor?: string
  botTextColor?: string
}

// memo — в открытом чате сообщения рефетчатся раз в 1.5с (см. refetchInterval в
// chat-conversation.tsx); без memo каждый poll перерисовывал все видимые пузыри
// целиком, даже если их данные не изменились.
export const MessageBubble = React.memo(function MessageBubble({
  message, isOwn, isBot, showAvatar, showName, isLastInGroup,
  messagesById, currentUserId, pinnedMessageIds,
  onReply, onEdit, onDelete, onForward, onReact, onScrollToMessage,
  onPin, onSelect, isSelected, selectMode,
  transcription, transcribing, onTranscribe,
  ownBubbleColor, otherBubbleColor, botBubbleColor, nickColor,
  fontSize, ownTextColor, otherTextColor, botTextColor,
}: Props) {
  const isDeleted = !!message.deleted_at
  const hasText = !!message.text
  const hasAttachments = !!message.attachments?.length
  const replyMsg = message.reply_to_message_id != null ? messagesById?.get(message.reply_to_message_id) : undefined
  const voiceAttachment = message.attachments?.find(a => a.mime_type.startsWith('audio/'))
  const isPinned = !!pinnedMessageIds?.has(message.id)
  const effectiveOwnText = ownTextColor ?? (ownBubbleColor ? getContrastColor(ownBubbleColor) : undefined)
  const effectiveOtherText = otherTextColor ?? (otherBubbleColor ? getContrastColor(otherBubbleColor) : undefined)
  const effectiveBotText = botTextColor ?? (botBubbleColor ? getContrastColor(botBubbleColor) : undefined)
  const isMediaOnly = !hasText && !message.reply_to_message_id && !message.deleted_at &&
    hasAttachments && message.attachments.every(a => a.mime_type.startsWith('image/') || a.mime_type.startsWith('video/'))

  const [ctxPos, setCtxPos] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ctxPos) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setCtxPos(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxPos])

  const handleCtx = (e: React.MouseEvent) => {
    if (selectMode) return
    e.preventDefault()
    const menuW = 210, menuH = 340
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8)
    setCtxPos({ x: Math.max(8, x), y: Math.max(8, y) })
  }

  const copyText = () => {
    if (message.text) navigator.clipboard.writeText(message.text).catch(() => {})
    setCtxPos(null)
  }

  const grouped = groupReactions(message.reactions ?? [])

  const ctxMenu = ctxPos && (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 py-1 min-w-[210px] overflow-hidden"
      style={{ top: ctxPos.y, left: ctxPos.x }}
      onClick={e => e.stopPropagation()}
    >
      {!isDeleted && onReact && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-700">
          {QUICK_EMOJIS.map(em => (
            <button key={em} onClick={() => { onReact(message, em); setCtxPos(null) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-base cursor-pointer transition-colors">
              {em}
            </button>
          ))}
        </div>
      )}
      {!isDeleted && onReply && <CtxItem onClick={() => { onReply(message); setCtxPos(null) }}><ReplyIcon />Ответить</CtxItem>}
      {hasText && <CtxItem onClick={copyText}><CopyIcon />Копировать</CtxItem>}
      {!isDeleted && onForward && <CtxItem onClick={() => { onForward(message); setCtxPos(null) }}><ForwardIcon />Переслать</CtxItem>}
      {!isDeleted && onPin && (
        <CtxItem onClick={() => { onPin(message); setCtxPos(null) }}>
          <PinIcon />{isPinned ? 'Открепить' : 'Закрепить'}
        </CtxItem>
      )}
      {!isDeleted && !hasAttachments && isOwn && onEdit && (
        <CtxItem onClick={() => { onEdit(message); setCtxPos(null) }}><PencilIcon />Редактировать</CtxItem>
      )}
      {onSelect && <CtxItem onClick={() => { onSelect(message); setCtxPos(null) }}><SelectIcon />Выбрать</CtxItem>}
      {isOwn && onDelete && (
        <CtxItem onClick={() => { onDelete(message); setCtxPos(null) }} danger><TrashIcon />Удалить</CtxItem>
      )}
    </div>
  )

  if (isBot) {
    return (
      <>
        <div
          id={`msg-${message.id}`}
          className={cn('flex justify-center my-1 px-4 py-1', selectMode && 'cursor-pointer')}
          onClick={selectMode ? (e) => { e.stopPropagation(); onSelect?.(message) } : undefined}
          onContextMenu={handleCtx}
        >
          <div className="relative max-w-[75%]">
          {selectMode && (
            <div className={cn(
              'absolute -left-7 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 flex items-center justify-center z-20 transition-all',
              isSelected ? 'bg-[#1B3A72] border-[#1B3A72]' : 'border-slate-300 bg-white dark:bg-slate-700 dark:border-slate-500'
            )}>
              {isSelected && <MiniCheckIcon />}
            </div>
          )}
          <div
            className={cn(
              'rounded-2xl px-2 py-2 shadow-sm border',
              !botBubbleColor && 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200/70 dark:border-indigo-700/40',
              botBubbleColor && 'border-transparent',
              selectMode && isSelected && 'ring-2 ring-[#1B3A72]'
            )}
            style={botBubbleColor ? { backgroundColor: botBubbleColor, color: effectiveBotText } : undefined}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Bot className="w-4 h-4" />
              <span className={cn('text-xs font-semibold', !botBubbleColor && 'text-indigo-600 dark:text-indigo-400')} style={{ opacity: botBubbleColor ? 0.8 : undefined }}>{message.sender_name}</span>
            </div>
            {isDeleted ? (
              <p className="text-sm text-center italic" style={{ opacity: 0.6 }}>Сообщение удалено</p>
            ) : (
              <>
                {message.reply_to_message_id != null && replyMsg && (
                  <div
                    className={cn('mb-2 pl-2 border-l-2 rounded py-0.5 cursor-pointer overflow-hidden min-w-0', !botBubbleColor && 'border-indigo-300 dark:border-indigo-600 bg-indigo-100/50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50')}
                    style={botBubbleColor && effectiveBotText ? { borderColor: hexToRgba(effectiveBotText, 0.4), backgroundColor: hexToRgba(effectiveBotText, 0.12) } : undefined}
                    onClick={() => onScrollToMessage?.(message.reply_to_message_id!)}
                  >
                    <p className={cn('text-xs font-semibold truncate', !botBubbleColor && 'text-indigo-600 dark:text-indigo-400')} style={{ opacity: botBubbleColor ? 0.85 : undefined }}>{replyMsg.sender_name}</p>
                    <p className={cn('text-xs truncate', !botBubbleColor && 'text-slate-500 dark:text-slate-400')} style={{ opacity: botBubbleColor ? 0.65 : undefined }}>
                      {replyMsg.deleted_at ? 'Сообщение удалено' : replyMsg.text || (replyMsg.attachments?.length ? <><Paperclip className="inline w-3 h-3 -mt-0.5 mr-1" />Вложение</> : '')}
                    </p>
                  </div>
                )}
                {hasText && <p className="text-sm whitespace-pre-wrap leading-relaxed text-center" style={{ ...(fontSize ? { fontSize: `${fontSize}px` } : {}), ...(effectiveBotText ? { color: effectiveBotText } : {}) }}>{message.text}</p>}
                {hasAttachments && (
                  <div className={cn('space-y-1.5', hasText && 'mt-2')}>
                    {message.attachments.map((a, i) => (
                      <AttachmentView
                        key={i}
                        attachment={a}
                        isOwn={false}
                        transcription={a === voiceAttachment ? transcription : undefined}
                        transcribing={a === voiceAttachment ? transcribing : undefined}
                        onTranscribe={a === voiceAttachment && voiceAttachment && onTranscribe ? () => onTranscribe(message, voiceAttachment.file_url) : undefined}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="text-[10px] text-indigo-400/70 dark:text-indigo-500 text-center mt-1.5">
              {message.edited_at && <span className="mr-1">ред.</span>}
              {new Date(message.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
            </div>
            {grouped.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                {grouped.map(({ emoji, userIds, count }) => (
                  <button key={emoji} onClick={() => onReact?.(message, emoji)}
                    className={cn(
                      'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer',
                      userIds.includes(currentUserId ?? -1)
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-600 text-indigo-700'
                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 hover:bg-slate-50'
                    )}>
                    <span>{emoji}</span><span className="font-medium">{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
        {ctxMenu}
      </>
    )
  }

  return (
    <>
      <div
        id={`msg-${message.id}`}
        className={cn(
          'flex gap-2 max-w-[78%] py-1',
          isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto',
          selectMode && 'cursor-pointer'
        )}
        onClick={selectMode ? (e) => { e.stopPropagation(); onSelect?.(message) } : undefined}
        onContextMenu={handleCtx}
      >
      {selectMode && (
        <div className={cn(
          'self-center w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
          isSelected ? 'bg-[#1B3A72] border-[#1B3A72]' : 'border-slate-300 bg-white dark:bg-slate-700 dark:border-slate-500'
        )}>
          {isSelected && <MiniCheckIcon />}
        </div>
      )}

      <div className="w-8 shrink-0 flex items-end pb-1">
        {!isOwn && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold">
            {message.sender_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
          </div>
        )}
      </div>

      <div className={cn('flex flex-col flex-1 min-w-0', isOwn ? 'items-end' : 'items-start')}>
        {showName && !isOwn && (
          <span
            className={cn('text-xs font-semibold px-1 mb-1', !nickColor && 'text-[#1B3A72] dark:text-blue-400')}
            style={nickColor ? { color: nickColor } : undefined}
          >
            {message.sender_name}
          </span>
        )}

        <div className="relative w-full">
          {isDeleted ? (
            <div
              className={cn(
                'px-3 py-2 text-sm shadow-sm opacity-60 italic w-fit',
                isOwn
                  ? [!ownBubbleColor && 'bg-[#1B3A72]', !effectiveOwnText && 'text-white', 'ml-auto', isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl']
                  : [!otherBubbleColor && 'bg-white dark:bg-slate-700', !effectiveOtherText && 'text-slate-500 dark:text-slate-400', isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl']
              )}
              style={isOwn && ownBubbleColor ? { backgroundColor: ownBubbleColor, color: effectiveOwnText } : !isOwn && otherBubbleColor ? { backgroundColor: otherBubbleColor, color: effectiveOtherText } : undefined}
            >
              Сообщение удалено
            </div>
          ) : isMediaOnly ? (
            <div className={cn('relative rounded-2xl overflow-hidden shadow-sm w-fit max-w-full', isOwn && 'ml-auto', selectMode && isSelected && 'ring-2 ring-[#1B3A72]')}>
              {message.attachments.map((a, i) => (
                <AttachmentView
                  key={i}
                  attachment={a}
                  isOwn={isOwn}
                  transcription={a === voiceAttachment ? transcription : undefined}
                  transcribing={a === voiceAttachment ? transcribing : undefined}
                  onTranscribe={a === voiceAttachment && voiceAttachment && onTranscribe ? () => onTranscribe(message, voiceAttachment.file_url) : undefined}
                />
              ))}
              <div className="absolute bottom-1 right-2 text-[10px] text-white/80 drop-shadow px-1">
                {message.edited_at && <span className="mr-1">ред.</span>}
                {new Date(message.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'relative px-2 py-2 text-sm break-all shadow-sm w-fit max-w-full',
                isOwn
                  ? [!ownBubbleColor && 'bg-[#1B3A72]', !effectiveOwnText && 'text-white', isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl', 'ml-auto']
                  : [!otherBubbleColor && 'bg-white dark:bg-slate-700', !effectiveOtherText && 'text-slate-800 dark:text-slate-100', isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl'],
                selectMode && isSelected && 'ring-2 ring-[#1B3A72]'
              )}
              style={isOwn && ownBubbleColor ? { backgroundColor: ownBubbleColor, color: effectiveOwnText } : !isOwn && otherBubbleColor ? { backgroundColor: otherBubbleColor, color: effectiveOtherText } : undefined}
            >
              {isPinned && (
                <div className="flex items-center gap-1 text-[10px] mb-1.5" style={{ opacity: 0.6 }}>
                  <PinIcon size={10} />закреплено
                </div>
              )}
              {message.reply_to_message_id != null && (() => {
                const effText = isOwn ? effectiveOwnText : effectiveOtherText
                const replyStyle: React.CSSProperties = {
                  maxWidth: '100%', minWidth: 0,
                  ...(effText ? { borderColor: hexToRgba(effText, 0.4), backgroundColor: hexToRgba(effText, 0.12) } : {}),
                }
                return (
                  <div
                    className={cn(
                      'mb-2 pl-2 border-l-2 rounded py-0.5 cursor-pointer overflow-hidden',
                      isOwn ? 'border-white/50 bg-white/10 hover:bg-white/20' : 'border-[#1B3A72]/40 bg-slate-50 dark:bg-slate-600/50 hover:bg-slate-100 dark:hover:bg-slate-600'
                    )}
                    style={replyStyle}
                    onClick={(e) => { e.stopPropagation(); onScrollToMessage?.(message.reply_to_message_id!) }}
                  >
                    {replyMsg ? (
                      <>
                        <p className="text-xs font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', opacity: 0.85 }}>{replyMsg.sender_name}</p>
                        <p className="text-xs" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px', opacity: 0.65 }}>
                          {replyMsg.deleted_at ? 'Сообщение удалено' : replyMsg.text || (replyMsg.attachments?.length ? <><Paperclip className="inline w-3 h-3 -mt-0.5 mr-1" />Вложение</> : '')}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs italic" style={{ opacity: 0.5 }}>Сообщение недоступно</p>
                    )}
                  </div>
                )
              })()}
              {hasText && <p className="whitespace-pre-wrap leading-relaxed break-all" style={{ ...(fontSize ? { fontSize: `${fontSize}px` } : {}), ...(effectiveOwnText && isOwn ? { color: effectiveOwnText } : effectiveOtherText && !isOwn ? { color: effectiveOtherText } : {}) }}>{renderLinks(message.text!, isOwn)}</p>}
              {hasAttachments && (
                <div className={cn('space-y-1.5', hasText && 'mt-2')}>
                  {message.attachments.map((a, i) => (
                    <AttachmentView
                      key={i}
                      attachment={a}
                      isOwn={isOwn}
                      transcription={a === voiceAttachment ? transcription : undefined}
                      transcribing={a === voiceAttachment ? transcribing : undefined}
                      onTranscribe={a === voiceAttachment && voiceAttachment && onTranscribe ? () => onTranscribe(message, voiceAttachment.file_url) : undefined}
                    />
                  ))}
                </div>
              )}
              <TimeStamp message={message} />
            </div>
          )}

          {grouped.length > 0 && (
            <div className={cn('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
              {grouped.map(({ emoji, userIds, count }) => (
                <button key={emoji} onClick={() => onReact?.(message, emoji)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer',
                    userIds.includes(currentUserId ?? -1)
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                  )}>
                  <span>{emoji}</span><span className="font-medium">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    {ctxMenu}
  </>
  )
})

function renderLinks(text: string, isOwn: boolean): React.ReactNode[] {
  const URL_RE = /https?:\/\/[^\s]+/g
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const url = match[0]
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('underline hover:opacity-80 break-all', isOwn ? 'text-white/90' : 'text-[#1B3A72] dark:text-blue-400')}
        onClick={e => e.stopPropagation()}
      >
        {url}
      </a>
    )
    last = match.index + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function groupReactions(reactions: { emoji: string; user_id: number }[]) {
  const map = new Map<string, number[]>()
  for (const r of reactions) {
    if (!map.has(r.emoji)) map.set(r.emoji, [])
    map.get(r.emoji)!.push(r.user_id)
  }
  return [...map.entries()].map(([emoji, userIds]) => ({ emoji, userIds, count: userIds.length }))
}


function CtxItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors cursor-pointer',
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600'
      )}>
      {children}
    </button>
  )
}

function TimeStamp({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-center gap-1 text-[10px] justify-end mt-1 -mb-0.5" style={{ opacity: 0.55 }}>
      {message.edited_at && <span>ред.</span>}
      <span>{new Date(message.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  )
}

export function DateSeparator({ date }: { date: Date }) {
  const now = new Date()
  let label: string
  if (date.toDateString() === now.toDateString()) {
    label = 'Сегодня'
  } else {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    label = date.toDateString() === yesterday.toDateString()
      ? 'Вчера'
      : date.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return (
    <div className="flex items-center justify-center py-3">
      <span className="text-xs text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-slate-100 dark:border-slate-600">
        {label}
      </span>
    </div>
  )
}


function ReplyIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
}
function ForwardIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>
}
function SelectIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="3" strokeLinecap="round" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
}

function CopyIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
}
export function PinIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.047 8.287 8.287 0 009 9.601a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.545 5.975 5.975 0 01-2.133-1.001A3.75 3.75 0 0012 18z" /></svg>
}
function PencilIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
}
function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
function MiniCheckIcon() {
  return <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
