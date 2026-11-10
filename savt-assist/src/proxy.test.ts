import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy, config } from './proxy'

function run(path: string, refreshToken?: string) {
  const req = new NextRequest(`http://localhost:3000${path}`, {
    headers: refreshToken ? { cookie: `refresh_token=${refreshToken}` } : {},
  })
  return proxy(req)
}

const redirectTo = (res: Response) => {
  const loc = res.headers.get('location')
  return loc ? new URL(loc).pathname : null
}
const passes = (res: Response) => res.headers.get('x-middleware-next') === '1'

describe('proxy: без сессии', () => {
  it.each(['/admin/dashboard', '/admin/users', '/operator/chats', '/admin'])('%s ведёт на /login', (path) => {
    const res = run(path)
    expect(res.status).toBe(307)
    expect(redirectTo(res)).toBe('/login')
  })

  it('страница входа открыта', () => {
    expect(passes(run('/login'))).toBe(true)
  })
})

describe('proxy: с сессией', () => {
  it.each(['/admin/dashboard', '/operator/chats'])('%s открывается', (path) => {
    expect(passes(run(path, 'tok'))).toBe(true)
  })

  it('уже вошедшего со страницы входа отправляет в панель', () => {
    expect(redirectTo(run('/login', 'tok'))).toBe('/admin/dashboard')
  })

  it('пустое значение cookie считается отсутствием сессии', () => {
    expect(redirectTo(run('/admin/dashboard', ''))).toBe('/login')
  })

  it('защищается только раздел /admin и /operator, а не любой путь с похожим началом в matcher', () => {
    expect(config.matcher).toEqual(['/login', '/admin/:path*', '/operator/:path*'])
  })
})

describe('proxy: matcher не захватывает API и прокси бэкенда', () => {
  // /backend/* не должен проходить через middleware: он буферизует тело запроса,
  // и крупные загрузки упираются в лимит (см. загрузку документов).
  it.each(['/backend/admin/documents', '/api/auth/refresh', '/_next/static/x.js'])('%s вне matcher', (path) => {
    const matched = config.matcher.some((m) => new RegExp(`^${m.replace(/:path\*/, '.*')}$`).test(path))
    expect(matched).toBe(false)
  })
})
