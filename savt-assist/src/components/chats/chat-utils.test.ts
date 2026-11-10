import { describe, expect, it } from 'vitest'
import type { Chat } from '@/types'
import { chatDisplayName, sortChats } from './chat-utils'

function chat(over: Partial<Chat> & { id: number }): Chat {
  return {
    chat_type: 'support',
    cabinet_id: null,
    cabinet_name: null,
    last_message_text: null,
    last_message_at: null,
    unread_count: 0,
    problem_status: null,
    bot_active: true,
    operator_requested: false,
    ...over,
  }
}

describe('chatDisplayName', () => {
  it('поддержка: с именем и без', () => {
    expect(chatDisplayName(chat({ id: 1, user_name: 'Иван' }))).toBe('Поддержка — Иван')
    expect(chatDisplayName(chat({ id: 1 }))).toBe('Поддержка #1')
  })

  it('ШУ: название и владелец', () => {
    expect(chatDisplayName(chat({ id: 2, chat_type: 'cabinet', cabinet_name: 'ШУ-15', user_name: 'Пётр' }))).toBe('ШУ-15 — Пётр')
    expect(chatDisplayName(chat({ id: 2, chat_type: 'cabinet', cabinet_name: 'ШУ-15' }))).toBe('ШУ-15')
    expect(chatDisplayName(chat({ id: 2, chat_type: 'cabinet' }))).toBe('ШУ #2')
  })

  it('проект и заметки', () => {
    expect(chatDisplayName(chat({ id: 3, chat_type: 'project', project_name: 'Школа', user_name: 'Анна' }))).toBe('Школа — Анна')
    expect(chatDisplayName(chat({ id: 3, chat_type: 'project' }))).toBe('Проект #3')
    expect(chatDisplayName(chat({ id: 4, chat_type: 'notes', user_name: 'Анна' }))).toBe('Заметки — Анна')
    expect(chatDisplayName(chat({ id: 4, chat_type: 'notes' }))).toBe('Заметки #4')
  })

  it('заявка: длинное описание обрезается до 36 символов с многоточием', () => {
    const long = 'а'.repeat(50)
    expect(chatDisplayName(chat({ id: 5, chat_type: 'service_request', service_request_description: long }))).toBe(`${'а'.repeat(36)}…`)
    expect(chatDisplayName(chat({ id: 5, chat_type: 'service_request', service_request_description: 'Короткое' }))).toBe('Короткое')
    expect(chatDisplayName(chat({ id: 5, chat_type: 'service_request' }))).toBe('Заявка #5')
  })
})

describe('sortChats', () => {
  const ids = (list: Chat[]) => list.map((c) => c.id)
  const none = new Set<number>()

  it('ждущие оператора выше остальных', () => {
    const list = [chat({ id: 1 }), chat({ id: 2, operator_requested: true })]
    expect(ids(sortChats(list, none))).toEqual([2, 1])
  })

  it('срочные выше обычных ждущих', () => {
    const list = [
      chat({ id: 1, operator_requested: true }),
      chat({ id: 2, operator_requested: true }),
    ]
    expect(ids(sortChats(list, new Set([2])))).toEqual([2, 1])
  })

  it('срочная отметка без operator_requested не поднимает чат (оператор уже взял его)', () => {
    const list = [chat({ id: 1 }), chat({ id: 2, operator_requested: true })]
    expect(ids(sortChats(list, new Set([1])))).toEqual([2, 1])
  })

  it('закреплённые выше незакреплённых внутри группы, но не выше ждущих оператора', () => {
    const list = [
      chat({ id: 1, is_pinned: true }),
      chat({ id: 2, operator_requested: true }),
      chat({ id: 3 }),
    ]
    expect(ids(sortChats(list, none))).toEqual([2, 1, 3])
  })

  it('прочее — по времени последнего сообщения, новые выше; без сообщений — в конец', () => {
    const list = [
      chat({ id: 1, last_message_at: '2026-10-01T10:00:00Z' }),
      chat({ id: 2, last_message_at: '2026-10-02T10:00:00Z' }),
      chat({ id: 3 }),
    ]
    expect(ids(sortChats(list, none))).toEqual([2, 1, 3])
  })

  it('не меняет исходный массив', () => {
    const list = [chat({ id: 1 }), chat({ id: 2, operator_requested: true })]
    sortChats(list, none)
    expect(ids(list)).toEqual([1, 2])
  })
})
