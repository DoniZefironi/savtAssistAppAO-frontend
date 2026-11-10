import { describe, expect, it } from 'vitest'
import type { Notification } from '@/lib/api/notifications'
import { collectUrgentChatIds } from './use-urgent-chats'

const NOW = new Date('2026-10-27T12:00:00Z').getTime()
const HOUR = 60 * 60 * 1000

function notif(over: Partial<Notification>): Notification {
  return {
    id: 1,
    type: 'operator_requested',
    title: 'СРОЧНО: возможна опасная ситуация',
    body: 'Пользователь сообщает об опасной ситуации в чате #42. Откройте чат как можно скорее',
    data: {},
    is_read: false,
    created_at: new Date(NOW - HOUR).toISOString(),
    ...over,
  }
}

describe('collectUrgentChatIds', () => {
  it('собирает номера чатов из срочных уведомлений', () => {
    const ids = collectUrgentChatIds([notif({}), notif({ id: 2, body: 'в чате #7' })], NOW)
    expect([...ids].sort()).toEqual([42, 7].sort())
  })

  it('обычный запрос оператора не попадает', () => {
    expect(collectUrgentChatIds([notif({ title: 'Пользователь просит оператора' })], NOW).size).toBe(0)
  })

  it('уведомление старше суток не попадает, ровно сутки — ещё да', () => {
    expect(collectUrgentChatIds([notif({ created_at: new Date(NOW - 25 * HOUR).toISOString() })], NOW).size).toBe(0)
    expect(collectUrgentChatIds([notif({ created_at: new Date(NOW - 24 * HOUR).toISOString() })], NOW).size).toBe(1)
  })

  it('прочитанное уведомление учитывается: прочесть не значит взять чат', () => {
    expect(collectUrgentChatIds([notif({ is_read: true })], NOW).has(42)).toBe(true)
  })

  it('без номера чата в тексте пропускается', () => {
    expect(collectUrgentChatIds([notif({ body: 'Откройте чат' })], NOW).size).toBe(0)
  })

  it('дубли по одному чату схлопываются', () => {
    expect(collectUrgentChatIds([notif({}), notif({ id: 2 })], NOW).size).toBe(1)
  })
})
