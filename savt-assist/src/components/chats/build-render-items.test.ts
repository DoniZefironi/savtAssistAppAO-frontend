import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '@/types'
import { buildRenderItems } from './build-render-items'

const ME = 1

function msg(id: number, sender_id: number, at: string, sender_name = 'Клиент'): ChatMessage {
  return {
    id, chat_id: 10, sender_id, sender_name, text: `m${id}`, reply_to_message_id: null,
    is_read: true, created_at: at, edited_at: null, deleted_at: null, attachments: [], reactions: [],
  }
}

const onlyMessages = (items: ReturnType<typeof buildRenderItems>) =>
  items.flatMap((i) => (i.type === 'message' ? [i] : []))

describe('buildRenderItems', () => {
  it('пустой список — пусто', () => {
    expect(buildRenderItems([], ME)).toEqual([])
  })

  it('перед первым сообщением дня идёт разделитель даты, дальше по одному на новый день', () => {
    const items = buildRenderItems([
      msg(1, 2, '2026-10-01T10:00:00'),
      msg(2, 2, '2026-10-01T10:01:00'),
      msg(3, 2, '2026-10-02T10:00:00'),
    ], ME)
    expect(items.map((i) => i.type)).toEqual(['date', 'message', 'message', 'date', 'message'])
  })

  it('разделитель «новые сообщения» ставится перед первым непрочитанным', () => {
    const items = buildRenderItems([
      msg(1, 2, '2026-10-01T10:00:00'),
      msg(2, 2, '2026-10-01T10:01:00'),
    ], ME, 2)
    expect(items.map((i) => i.type)).toEqual(['date', 'message', 'unread-divider', 'message'])
  })

  it('свои сообщения помечены isOwn и без аватара/имени', () => {
    const [m] = onlyMessages(buildRenderItems([msg(1, ME, '2026-10-01T10:00:00', 'Я')], ME))
    expect(m).toMatchObject({ isOwn: true, isBot: false, showAvatar: false, showName: false })
  })

  it.each(['Ася', 'Bot', 'bot', 'Asya'])('сообщение от «%s» считается ботом', (name) => {
    const [m] = onlyMessages(buildRenderItems([msg(1, 99, '2026-10-01T10:00:00', name)], ME))
    expect(m).toMatchObject({ isBot: true, showAvatar: false, showName: false })
  })

  it('бот в роли своего отправителя не помечается ботом (isOwn важнее)', () => {
    const [m] = onlyMessages(buildRenderItems([msg(1, ME, '2026-10-01T10:00:00', 'Ася')], ME))
    expect(m).toMatchObject({ isOwn: true, isBot: false })
  })

  it('подряд идущие сообщения одного автора группируются: имя у первого, аватар у последнего', () => {
    const [a, b, c] = onlyMessages(buildRenderItems([
      msg(1, 2, '2026-10-01T10:00:00'),
      msg(2, 2, '2026-10-01T10:01:00'),
      msg(3, 2, '2026-10-01T10:02:00'),
    ], ME))
    expect([a.showName, b.showName, c.showName]).toEqual([true, false, false])
    expect([a.showAvatar, b.showAvatar, c.showAvatar]).toEqual([false, false, true])
    expect([a.isLastInGroup, b.isLastInGroup, c.isLastInGroup]).toEqual([false, false, true])
  })

  it('пауза 5 минут и больше разрывает группу', () => {
    const [a, b] = onlyMessages(buildRenderItems([
      msg(1, 2, '2026-10-01T10:00:00'),
      msg(2, 2, '2026-10-01T10:05:00'),
    ], ME))
    expect(a.isLastInGroup).toBe(true)
    expect(b.showName).toBe(true)
  })

  it('смена автора разрывает группу', () => {
    const [a, b] = onlyMessages(buildRenderItems([
      msg(1, 2, '2026-10-01T10:00:00'),
      msg(2, 3, '2026-10-01T10:00:30', 'Оператор'),
    ], ME))
    expect(a.isLastInGroup).toBe(true)
    expect(b.showName).toBe(true)
  })
})
