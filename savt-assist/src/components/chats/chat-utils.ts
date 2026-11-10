import type { Chat } from '@/types'

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s
}

export function chatDisplayName(chat: Chat): string {
  const user = chat.user_name ?? null
  if (chat.chat_type === 'cabinet') {
    const cabinet = chat.cabinet_name ?? `ШУ #${chat.id}`
    return chat.user_name ? `${cabinet} — ${chat.user_name}` : cabinet
  }
  if (chat.chat_type === 'project') {
    const project = chat.project_name ?? `Проект #${chat.id}`
    return user ? `${project} — ${user}` : project
  }
  if (chat.chat_type === 'notes') return user ? `Заметки — ${user}` : `Заметки #${chat.id}`
  if (chat.chat_type === 'support') return user ? `Поддержка — ${user}` : `Поддержка #${chat.id}`
  if (chat.chat_type === 'service_request') {
    const title = chat.service_request_description ? truncate(chat.service_request_description, 36) : `Заявка #${chat.id}`
    return user ? `${title} — ${user}` : title
  }
  return `Чат #${chat.id}`
}

// Порядок списка: ждущие оператора выше всех, среди них срочные (опасная
// ситуация) выше обычных, затем закреплённые, затем по времени последнего сообщения.
export function sortChats(chats: Chat[], urgentIds: ReadonlySet<number>): Chat[] {
  const isUrgent = (c: Chat) => c.operator_requested && urgentIds.has(c.id)
  return [...chats].sort((a, b) => {
    if (a.operator_requested && !b.operator_requested) return -1
    if (!a.operator_requested && b.operator_requested) return 1
    if (isUrgent(a) && !isUrgent(b)) return -1
    if (!isUrgent(a) && isUrgent(b)) return 1
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
  })
}
