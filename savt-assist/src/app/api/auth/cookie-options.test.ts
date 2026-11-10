import { afterEach, describe, expect, it, vi } from 'vitest'
import { refreshCookieOptions } from './cookie-options'

function jwt(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'none' })}.${enc(payload)}.sig`
}

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

afterEach(() => vi.useRealTimers())

describe('refreshCookieOptions', () => {
  it('cookie недоступна из JS и не уходит со сторонних сайтов', () => {
    const o = refreshCookieOptions(jwt({}), req('https://panel.example/api/auth/login'))
    expect(o.httpOnly).toBe(true)
    expect(o.sameSite).toBe('strict')
    expect(o.path).toBe('/')
  })

  it('срок жизни берётся из exp токена', () => {
    vi.useFakeTimers({ now: new Date('2026-10-27T12:00:00Z') })
    const exp = Math.floor(Date.now() / 1000) + 3600
    expect(refreshCookieOptions(jwt({ exp }), req('https://x/')).maxAge).toBe(3600)
  })

  it('уже истёкший токен даёт maxAge 0, а не отрицательное число', () => {
    vi.useFakeTimers({ now: new Date('2026-10-27T12:00:00Z') })
    const exp = Math.floor(Date.now() / 1000) - 100
    expect(refreshCookieOptions(jwt({ exp }), req('https://x/')).maxAge).toBe(0)
  })

  it('токен без exp или не JWT — сессионная cookie без maxAge', () => {
    expect(refreshCookieOptions(jwt({}), req('https://x/')).maxAge).toBeUndefined()
    expect(refreshCookieOptions('не-jwt', req('https://x/')).maxAge).toBeUndefined()
  })

  describe('secure', () => {
    it('https — secure', () => {
      expect(refreshCookieOptions(jwt({}), req('https://x/')).secure).toBe(true)
    })

    it('http без прокси — не secure, иначе браузер молча не сохранит cookie', () => {
      expect(refreshCookieOptions(jwt({}), req('http://10.1.0.208:8080/')).secure).toBe(false)
    })

    it('X-Forwarded-Proto от прокси важнее схемы самого запроса', () => {
      expect(refreshCookieOptions(jwt({}), req('http://internal/', { 'x-forwarded-proto': 'https' })).secure).toBe(true)
      expect(refreshCookieOptions(jwt({}), req('https://internal/', { 'x-forwarded-proto': 'http' })).secure).toBe(false)
    })
  })
})
