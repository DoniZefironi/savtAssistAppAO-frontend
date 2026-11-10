import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  post: vi.fn(),
  ensureFreshToken: vi.fn(),
}))
vi.mock('./client', () => ({
  apiClient: { post: h.post, get: vi.fn(), delete: vi.fn(), patch: vi.fn(), put: vi.fn() },
  authorizedFetch: vi.fn(),
  ensureFreshToken: h.ensureFreshToken,
}))

import { mediaApi } from './media'

const file = new File(['pdf'], 'схема.pdf', { type: 'application/pdf' })

beforeEach(() => {
  vi.clearAllMocks()
  h.ensureFreshToken.mockResolvedValue(undefined)
  h.post.mockResolvedValue({ data: { id: 1 } })
})

const sentForm = () => h.post.mock.calls[0][1] as FormData
const sentConfig = () => h.post.mock.calls[0][2]

describe('загрузка документа ШУ', () => {
  it('поля формы: файл, cabinet_id, название и оба флага строками', async () => {
    await mediaApi.uploadDocument(15, file, 'Схема', true, false)
    expect(h.post.mock.calls[0][0]).toBe('/admin/documents')
    const form = sentForm()
    expect(form.get('file')).toBeInstanceOf(File)
    expect(form.get('cabinet_id')).toBe('15')
    expect(form.get('project_id')).toBeNull()
    expect(form.get('title')).toBe('Схема')
    expect(form.get('requires_approval')).toBe('true')
    expect(form.get('is_internal')).toBe('false')
  })

  it('без названия поле title не отправляется, флаги по умолчанию false', async () => {
    await mediaApi.uploadDocument(15, file)
    const form = sentForm()
    expect(form.has('title')).toBe(false)
    expect(form.get('requires_approval')).toBe('false')
    expect(form.get('is_internal')).toBe('false')
  })

  it('служебный документ: is_internal=true', async () => {
    await mediaApi.uploadDocument(15, file, undefined, false, true)
    expect(sentForm().get('is_internal')).toBe('true')
  })

  it('возвращает документ из ответа сервера', async () => {
    h.post.mockResolvedValue({ data: { id: 77, title: 'Схема' } })
    await expect(mediaApi.uploadDocument(15, file)).resolves.toEqual({ id: 77, title: 'Схема' })
  })
})

describe('загрузка документа проекта', () => {
  it('вместо cabinet_id уходит project_id', async () => {
    await mediaApi.uploadProjectDocument(3, file)
    const form = sentForm()
    expect(form.get('project_id')).toBe('3')
    expect(form.get('cabinet_id')).toBeNull()
  })
})

describe('параметры длинной загрузки', () => {
  it('токен обновляется до отправки, а не после', async () => {
    const order: string[] = []
    h.ensureFreshToken.mockImplementation(async () => { order.push('token') })
    h.post.mockImplementation(async () => { order.push('post'); return { data: {} } })
    await mediaApi.uploadDocument(1, file)
    expect(order).toEqual(['token', 'post'])
  })

  it('если обновить токен не вышло, файл не отправляется', async () => {
    h.ensureFreshToken.mockRejectedValue(new Error('401'))
    await expect(mediaApi.uploadDocument(1, file)).rejects.toThrow('401')
    expect(h.post).not.toHaveBeenCalled()
  })

  it('без таймаута, а Content-Type отдан браузеру (нужен boundary multipart)', async () => {
    await mediaApi.uploadDocument(1, file)
    expect(sentConfig().timeout).toBe(0)
    expect(sentConfig().headers).toEqual({ 'Content-Type': undefined })
  })

  it('сигнал отмены передаётся в запрос', async () => {
    const ctrl = new AbortController()
    await mediaApi.uploadDocument(1, file, undefined, false, false, { signal: ctrl.signal })
    expect(sentConfig().signal).toBe(ctrl.signal)
  })

  it('прогресс переводится в проценты и округляется', async () => {
    const onProgress = vi.fn()
    await mediaApi.uploadDocument(1, file, undefined, false, false, { onProgress })
    const report = sentConfig().onUploadProgress as (e: { loaded: number; total?: number }) => void
    report({ loaded: 1, total: 3 })
    report({ loaded: 3, total: 3 })
    expect(onProgress.mock.calls).toEqual([[33], [100]])
  })

  it('размер неизвестен (total нет) — прогресс не сообщается, а не NaN', async () => {
    const onProgress = vi.fn()
    await mediaApi.uploadDocument(1, file, undefined, false, false, { onProgress })
    const report = sentConfig().onUploadProgress as (e: { loaded: number; total?: number }) => void
    report({ loaded: 500 })
    expect(onProgress).not.toHaveBeenCalled()
  })

  it('без колбэка прогресс не падает', async () => {
    await mediaApi.uploadDocument(1, file)
    const report = sentConfig().onUploadProgress as (e: { loaded: number; total?: number }) => void
    expect(() => report({ loaded: 1, total: 2 })).not.toThrow()
  })
})
