import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError } from 'axios'

const jar = vi.hoisted(() => ({ values: {} as Record<string, string> }))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (name in jar.values ? { name, value: jar.values[name] } : undefined),
  }),
}))

import { POST as login } from './login/route'
import { POST as refresh } from './refresh/route'
import { POST as logout } from './logout/route'

const post = vi.spyOn(axios, 'post')
const get = vi.spyOn(axios, 'get')

const json = (body: unknown) =>
  new Request('https://panel.example/api/auth/login', { method: 'POST', body: JSON.stringify(body) })
const plain = () => new Request('https://panel.example/api/auth/x', { method: 'POST' })

// Set-Cookie у ответа: нужна ли и с какими флагами
const setCookie = (res: Response) => res.headers.get('set-cookie') ?? ''

function axiosError(status: number, data: unknown): AxiosError {
  const err = new AxiosError('fail')
  err.response = { status, data, statusText: '', headers: {}, config: {} as never }
  return err
}

beforeEach(() => {
  post.mockReset()
  get.mockReset()
  jar.values = {}
})

describe('POST /api/auth/login', () => {
  it('успех: access_token и user в теле, refresh_token только в HttpOnly cookie', async () => {
    post.mockResolvedValue({ data: { access_token: 'AT', refresh_token: 'RT' } })
    get.mockResolvedValue({ data: { id: 1, role: 'admin' } })

    const res = await login(json({ login: 'a', password: 'b' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ access_token: 'AT', user: { id: 1, role: 'admin' } })
    expect(JSON.stringify(body)).not.toContain('RT')
    expect(setCookie(res)).toContain('refresh_token=RT')
    expect(setCookie(res).toLowerCase()).toContain('httponly')
    expect(setCookie(res).toLowerCase()).toContain('samesite=strict')
  })

  it('логин и пароль уходят на admin-login', async () => {
    post.mockResolvedValue({ data: { access_token: 'AT', refresh_token: 'RT' } })
    get.mockResolvedValue({ data: {} })
    await login(json({ login: 'a', password: 'b' }))
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/auth/admin-login'), { login: 'a', password: 'b' })
  })

  it('неверный пароль: статус и текст ошибки бэкенда сохраняются, cookie нет', async () => {
    post.mockRejectedValue(axiosError(401, { detail: 'Неверный логин или пароль' }))
    const res = await login(json({ login: 'a', password: 'x' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ detail: 'Неверный логин или пароль' })
    expect(setCookie(res)).not.toContain('refresh_token')
  })

  it('бэкенд недоступен — 502', async () => {
    post.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await login(json({ login: 'a', password: 'b' }))
    expect(res.status).toBe(502)
  })
})

describe('POST /api/auth/refresh', () => {
  it('без cookie — 401, на бэкенд не ходит', async () => {
    const res = await refresh(plain())
    expect(res.status).toBe(401)
    expect(post).not.toHaveBeenCalled()
  })

  it('успех: клиенту только access_token, новый refresh_token в cookie', async () => {
    jar.values.refresh_token = 'OLD1'
    post.mockResolvedValue({ data: { access_token: 'AT2', refresh_token: 'NEW1' } })
    const res = await refresh(plain())
    const body = await res.json()
    expect(body).toEqual({ access_token: 'AT2' })
    expect(setCookie(res)).toContain('refresh_token=NEW1')
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), { refresh_token: 'OLD1' })
  })

  it('параллельные запросы с одним токеном дают один вызов бэкенда (иначе бэкенд оборвёт все сессии)', async () => {
    jar.values.refresh_token = 'SAME'
    post.mockResolvedValue({ data: { access_token: 'AT', refresh_token: 'NEW' } })
    const [a, b, c] = await Promise.all([refresh(plain()), refresh(plain()), refresh(plain())])
    expect(post).toHaveBeenCalledTimes(1)
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])
  })

  it('отказ бэкенда: 401 и cookie стирается', async () => {
    jar.values.refresh_token = 'BAD'
    post.mockRejectedValue(axiosError(401, {}))
    const res = await refresh(plain())
    expect(res.status).toBe(401)
    expect(setCookie(res)).toMatch(/refresh_token=;/)
  })

  it('после отказа следующий заход получает честный ответ бэкенда, а не закэшированный отказ', async () => {
    jar.values.refresh_token = 'RETRY'
    post.mockRejectedValueOnce(axiosError(401, {}))
    await refresh(plain())
    post.mockResolvedValueOnce({ data: { access_token: 'AT', refresh_token: 'NEW' } })
    const res = await refresh(plain())
    expect(res.status).toBe(200)
    expect(post).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/auth/logout', () => {
  it('инвалидирует токен на бэкенде и стирает cookie', async () => {
    jar.values.refresh_token = 'RT'
    post.mockResolvedValue({ data: {} })
    const res = await logout()
    expect(res.status).toBe(204)
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/auth/logout'), { refresh_token: 'RT' })
    expect(setCookie(res)).toMatch(/refresh_token=;/)
  })

  it('бэкенд не ответил — cookie всё равно стирается', async () => {
    jar.values.refresh_token = 'RT'
    post.mockRejectedValue(new Error('down'))
    const res = await logout()
    expect(res.status).toBe(204)
    expect(setCookie(res)).toMatch(/refresh_token=;/)
  })

  it('без cookie выходит без обращения к бэкенду', async () => {
    const res = await logout()
    expect(res.status).toBe(204)
    expect(post).not.toHaveBeenCalled()
  })
})
