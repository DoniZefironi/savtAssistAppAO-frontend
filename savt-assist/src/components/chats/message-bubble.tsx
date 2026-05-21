import { cn } from '@/lib/utils'
import { AttachmentView } from './attachment-view'
import type { ChatMessage } from '@/types'

interface Props {
  message: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  showName: boolean
  isLastInGroup: boolean
}

export function MessageBubble({ message, isOwn, showAvatar, showName, isLastInGroup }: Props) {
  const isDeleted = !!message.deleted_at
  const hasText = !!message.text
  const hasAttachments = message.attachments?.length > 0
  // Если только вложения без текста — не рисуем пузырёк, вложения идут напрямую
  const attachmentsOnly = hasAttachments && !hasText

  return (
    <div className={cn('flex gap-2 max-w-[78%]', isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
      {/* Avatar */}
      <div className="w-8 flex-shrink-0 flex items-end pb-1">
        {!isOwn && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold">
            {message.sender_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
          </div>
        )}
      </div>

      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        {showName && !isOwn && (
          <span className="text-xs font-semibold text-[#1B3A72] px-1 mb-1">
            {message.sender_name}
          </span>
        )}

        {isDeleted ? (
          /* Deleted message */
          <div className={cn(
            'px-3 py-2 text-sm rounded-2xl shadow-sm opacity-60 italic',
            isOwn ? 'bg-[#1B3A72] text-white' : 'bg-white text-slate-500'
          )}>
            Сообщение удалено
          </div>
        ) : attachmentsOnly ? (
          /* Attachments only — no bubble wrapper */
          <div className="space-y-1.5">
            {message.attachments.map((a, i) => (
              <AttachmentView key={i} attachment={a} isOwn={isOwn} />
            ))}
            <TimeStamp message={message} isOwn={isOwn} bare />
          </div>
        ) : (
          /* Normal bubble */
          <div className={cn(
            'relative px-3 py-2 text-sm break-words shadow-sm',
            isOwn
              ? ['bg-[#1B3A72] text-white', isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl']
              : ['bg-white text-slate-800', isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl']
          )}>
            {hasText && <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>}
            {hasAttachments && (
              <div className={cn('space-y-1.5', hasText && 'mt-2')}>
                {message.attachments.map((a, i) => (
                  <AttachmentView key={i} attachment={a} isOwn={isOwn} />
                ))}
              </div>
            )}
            <TimeStamp message={message} isOwn={isOwn} />
          </div>
        )}
      </div>
    </div>
  )
}

function TimeStamp({ message, isOwn, bare }: { message: ChatMessage; isOwn: boolean; bare?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1 text-[10px]',
      bare ? 'justify-end px-1 mt-0.5' : 'justify-end mt-1 -mb-0.5',
      isOwn ? 'text-white/60' : 'text-slate-400'
    )}>
      {message.edited_at && <span>ред.</span>}
      <span>
        {new Date(message.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
      </span>
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
      <span className="text-xs text-slate-500 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-slate-100">
        {label}
      </span>
    </div>
  )
}
