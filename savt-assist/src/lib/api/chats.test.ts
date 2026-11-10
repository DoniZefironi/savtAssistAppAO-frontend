import { beforeEach, describe, expect, it, vi } from 'vitest'

// Подменяем только HTTP-клиент: проверяем, какой запрос уходит на сервер.
const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
}))
vi.mock('./client', () => ({ apiClient: http }))

import { chatsApi } from './chats'

beforeEach(() => {
  vi.clearAllMocks()
  http.get.mockResolvedValue({ data: [] })
  http.post.mockResolvedValue({ data: {} })
  http.put.mockResolvedValue({ data: [] })
  http.delete.mockResolvedValue({ data: [] })
})

describe('бот и оператор', () => {
  it('«Взять чат» — POST /operator/chats/{id}/take', async () => {
    await chatsApi.takeChat(5)
    expect(http.post).toHaveBeenCalledWith('/operator/chats/5/take')
  })

  it('«Вернуть боту» — POST /operator/chats/{id}/return-to-bot', async () => {
    await chatsApi.returnToBot(5)
    expect(http.post).toHaveBeenCalledWith('/operator/chats/5/return-to-bot')
  })
})

describe('сообщения', () => {
  it('отправка: пустой текст и пустые вложения не уходят в тело', async () => {
    await chatsApi.sendMessage(1, '', [], undefined)
    expect(http.post).toHaveBeenCalledWith('/operator/chats/1/messages', {
      text: undefined, attachments: undefined, reply_to_message_id: undefined,
    })
  })

  it('отправка: текст, вложения и ответ передаются', async () => {
    const att = [{ type: 'image', url: '/u/a.png' }] as never
    await chatsApi.sendMessage(1, 'привет', att, 9)
    expect(http.post).toHaveBeenCalledWith('/operator/chats/1/messages', {
      text: 'привет', attachments: att, reply_to_message_id: 9,
    })
  })

  it('загрузка страницы: limit 30 и только заданные курсоры', async () => {
    await chatsApi.getMessages(1)
    expect(http.get).toHaveBeenLastCalledWith('/operator/chats/1/messages', { params: { limit: 30 } })
    await chatsApi.getMessages(1, 100, undefined, 'шу')
    expect(http.get).toHaveBeenLastCalledWith('/operator/chats/1/messages', { params: { limit: 30, before_id: 100, search: 'шу' } })
  })

  it('удаление нескольких сообщений — одним запросом с message_ids', async () => {
    http.delete.mockResolvedValue({ data: { deleted_ids: [1, 2] } })
    const res = await chatsApi.deleteMessages(1, [1, 2])
    expect(http.delete).toHaveBeenCalledWith('/chats/1/messages', { data: { message_ids: [1, 2] } })
    expect(res.deleted_ids).toEqual([1, 2])
  })

  it('удаление больше 100 сообщений режется на пачки по 100, результаты складываются', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1)
    http.delete.mockImplementation(async (_url: string, cfg: { data: { message_ids: number[] } }) => ({
      data: { deleted_ids: cfg.data.message_ids },
    }))
    const res = await chatsApi.deleteMessages(1, ids)
    expect(http.delete).toHaveBeenCalledTimes(3)
    expect(http.delete.mock.calls.map((c) => (c[1] as { data: { message_ids: number[] } }).data.message_ids.length)).toEqual([100, 100, 50])
    expect(res.deleted_ids).toEqual(ids)
  })

  it('ровно 100 сообщений — один запрос', async () => {
    http.delete.mockResolvedValue({ data: { deleted_ids: [] } })
    await chatsApi.deleteMessages(1, Array.from({ length: 100 }, (_, i) => i))
    expect(http.delete).toHaveBeenCalledTimes(1)
  })

  it('реакция: эмодзи кодируется в URL', async () => {
    await chatsApi.addReaction(1, 2, '👍')
    expect(http.post).toHaveBeenCalledWith(`/chats/1/messages/2/reactions/${encodeURIComponent('👍')}`)
  })
})

describe('закрепы', () => {
  it('закреп сообщения возвращает актуальный список', async () => {
    http.put.mockResolvedValue({ data: [{ id: 2 }] })
    expect(await chatsApi.pinMessage(1, 2)).toEqual([{ id: 2 }])
    expect(http.put).toHaveBeenCalledWith('/operator/chats/1/pin/2')
  })

  it('getPinnedMessages: при ошибке сервера возвращает пустой список, а не падает', async () => {
    http.get.mockRejectedValue(new Error('500'))
    expect(await chatsApi.getPinnedMessages(1)).toEqual([])
  })

  it('закреп самого чата в списке — отдельные эндпоинты pin-chat', async () => {
    await chatsApi.pinChat(3)
    await chatsApi.unpinChat(3)
    expect(http.put).toHaveBeenCalledWith('/operator/chats/3/pin-chat')
    expect(http.delete).toHaveBeenCalledWith('/operator/chats/3/pin-chat')
  })
})

describe('вложения и голос', () => {
  it('uploadAttachment кладёт файл в поле file', async () => {
    http.post.mockResolvedValue({ data: { url: '/u/x.png' } })
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    const res = await chatsApi.uploadAttachment(file)
    expect(res.url).toBe('/u/x.png')
    const [path, form] = http.post.mock.calls[0] as [string, FormData]
    expect(path).toBe('/upload/attachment')
    expect(form.get('file')).toBeInstanceOf(File)
  })

  it('расшифровка голоса: таймаут 120 с', async () => {
    http.post.mockResolvedValue({ data: { text: 'ок' } })
    await chatsApi.transcribeVoice('/u/v.ogg')
    expect(http.post).toHaveBeenCalledWith('/upload/transcribe', { file_url: '/u/v.ogg' }, { timeout: 120_000 })
  })

  it('вложения чата: фильтр type передаётся только если задан', async () => {
    await chatsApi.getAttachments(1)
    expect(http.get).toHaveBeenLastCalledWith('/operator/chats/1/attachments', { params: undefined })
    await chatsApi.getAttachments(1, 'voice')
    expect(http.get).toHaveBeenLastCalledWith('/operator/chats/1/attachments', { params: { type: 'voice' } })
  })
})

describe('управление чатом', () => {
  it('очистка истории и удаление чата', async () => {
    await chatsApi.clearHistory(7)
    await chatsApi.deleteChat(7)
    expect(http.delete).toHaveBeenCalledWith('/operator/chats/7/messages')
    expect(http.delete).toHaveBeenCalledWith('/operator/chats/7')
  })

  it('прочитано — POST /chats/{id}/read', async () => {
    await chatsApi.markRead(7)
    expect(http.post).toHaveBeenCalledWith('/chats/7/read')
  })

  it('поиск по всем сообщениям: q, page и size', async () => {
    http.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pages: 0 } })
    await chatsApi.searchAllMessages('шу', 2, 50)
    expect(http.get).toHaveBeenCalledWith('/operator/messages', { params: { q: 'шу', page: 2, size: 50 } })
  })
})
