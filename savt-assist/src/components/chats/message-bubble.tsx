import { cn } from '@/lib/utils'
import { AttachmentView } from './attachment-view'
import type { ChatMessage } from '@/types'

interface Props {
  message: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  showName: boolean
  isLastInGroup: boolean
  messagesById?: Map<number, ChatMessage>
  onReply?: (msg: ChatMessage) => void
  onEdit?: (msg: ChatMessage) => void
  onDelete?: (msg: ChatMessage) => void
  onForward?: (msg: ChatMessage) => void
  onScrollToMessage?: (id: number) => void
}

export function MessageBubble({ message, isOwn, showAvatar, showName, isLastInGroup, messagesById, onReply, onEdit, onDelete, onForward, onScrollToMessage }: Props) {
  const isDeleted = !!message.deleted_at
  const hasText = !!message.text
  const hasAttachments = message.attachments?.length > 0
  const replyMsg = message.reply_to_message_id != null ? messagesById?.get(message.reply_to_message_id) : undefined

  return (
    <div id={`msg-${message.id}`} className={cn('flex gap-2 max-w-[78%] group/msg', isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
      <div className="w-8 shrink-0 flex items-end pb-1">
        {!isOwn && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold">
            {message.sender_name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
          </div>
        )}
      </div>

      <div className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {showName && !isOwn && (
          <span className="text-xs font-semibold text-[#1B3A72] dark:text-blue-400 px-1 mb-1">
            {message.sender_name}
          </span>
        )}

        <div className="relative">
          <div className={cn(
            'absolute top-1 flex items-center gap-0.5 bg-white dark:bg-slate-700 rounded-xl shadow-md border border-slate-100 dark:border-slate-600 px-1 py-0.5 z-10',
            'opacity-0 group-hover/msg:opacity-100 transition-opacity pointer-events-none group-hover/msg:pointer-events-auto',
            isOwn ? 'right-full mr-2' : 'left-full ml-2'
          )}>
            {!isDeleted && <ActionBtn title="Ответить" onClick={() => onReply?.(message)}><ReplyIcon /></ActionBtn>}
            {!isDeleted && <ActionBtn title="Переслать" onClick={() => onForward?.(message)}><ForwardIcon /></ActionBtn>}
            {!isDeleted && isOwn && !hasAttachments && onEdit && (
              <ActionBtn title="Редактировать" onClick={() => onEdit(message)}><PencilIcon /></ActionBtn>
            )}
            {isOwn && onDelete && (
              <ActionBtn title="Удалить" danger onClick={() => onDelete(message)}><TrashIcon /></ActionBtn>
            )}
          </div>

          {isDeleted ? (
            <div className={cn(
              'px-3 py-2 text-sm rounded-2xl shadow-sm opacity-60 italic',
              isOwn ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            )}>
              Сообщение удалено
            </div>
          ) : (
            <div className={cn(
              'relative px-3 py-2 text-sm break-words shadow-sm',
              isOwn
                ? ['bg-[#1B3A72] text-white', isLastInGroup ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl']
                : ['bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100', isLastInGroup ? 'rounded-2xl rounded-bl-sm' : 'rounded-2xl']
            )}>
              {message.reply_to_message_id != null && (
                <div
                  className={cn(
                    'mb-2 pl-2 border-l-2 rounded py-0.5 cursor-pointer',
                    isOwn ? 'border-white/50 bg-white/10 hover:bg-white/20' : 'border-[#1B3A72]/40 bg-slate-50 dark:bg-slate-600/50 hover:bg-slate-100 dark:hover:bg-slate-600'
                  )}
                  onClick={() => onScrollToMessage?.(message.reply_to_message_id!)}
                >
                  {replyMsg ? (
                    <>
                      <p className={cn('text-xs font-semibold truncate', isOwn ? 'text-white/80' : 'text-[#1B3A72] dark:text-blue-400')}>
                        {replyMsg.sender_name}
                      </p>
                      <p className={cn('text-xs truncate', isOwn ? 'text-white/60' : 'text-slate-500 dark:text-slate-400')}>
                        {replyMsg.deleted_at ? 'Сообщение удалено' : replyMsg.text || (replyMsg.attachments?.length ? '📎 Вложение' : '')}
                      </p>
                    </>
                  ) : (
                    <p className={cn('text-xs italic', isOwn ? 'text-white/50' : 'text-slate-400')}>Сообщение недоступно</p>
                  )}
                </div>
              )}

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
    </div>
  )
}

function ActionBtn({ title, onClick, danger, children }: {
  title: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded-lg transition-colors',
        danger
          ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
          : 'text-slate-400 dark:text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-600'
      )}
    >
      {children}
    </button>
  )
}

function TimeStamp({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-1 text-[10px] justify-end mt-1 -mb-0.5',
      isOwn ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'
    )}>
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
function PencilIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
}
function TrashIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
