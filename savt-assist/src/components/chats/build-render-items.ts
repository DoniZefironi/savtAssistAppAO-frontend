import type { ChatMessage } from '@/types'

const GROUP_GAP_MS = 5 * 60 * 1000
const BOT_NAMES = new Set(['Ася', 'Bot', 'bot', 'Asya'])

export type RenderItem =
  | { type: 'date'; date: Date }
  | { type: 'unread-divider' }
  | { type: 'message'; message: ChatMessage; isOwn: boolean; isBot: boolean; showAvatar: boolean; showName: boolean; isLastInGroup: boolean }

export function buildRenderItems(messages: ChatMessage[], myId: number, firstUnreadId?: number): RenderItem[] {
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
