import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { ensureFreshToken, setAccessToken } from './client'

// JWT без подписи: клиент читает только payload.exp.
function jwt(expSecondsFromNow: number | null): string {
  const payload = expSecondsFromNow === null ? {} : { exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'none' })}.${enc(payload)}.sig`
}

describe('ensureFreshToken', () => {
  const post = vi.spyOn(axios, 'post')

  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: { access_token: jwt(3600) } })
    // refreshTokens при ошибке ходит в window.location
    vi.stubGlobal('window', { location: { href: '' } })
  })

  afterEach(() => {
    setAccessToken(null)
    vi.unstubAllGlobals()
  })

  it('токен живёт дольше порога — refresh не вызывается', async () => {
    setAccessToken(jwt(3600))
    await ensureFreshToken()
    expect(post).not.toHaveBeenCalled()
  })

  it('токен истекает меньше чем через 5 минут — обновляется', async () => {
    setAccessToken(jwt(60))
    await ensureFreshToken()
    expect(post).toHaveBeenCalledWith('/api/auth/refresh')
  })

  it('токен уже истёк — обновляется', async () => {
    setAccessToken(jwt(-10))
    await ensureFreshToken()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('токена нет вообще — обновляется', async () => {
    setAccessToken(null)
    await ensureFreshToken()
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('токен без exp или не JWT считается живым, чтобы не уйти в цикл refresh', async () => {
    setAccessToken(jwt(null))
    await ensureFreshToken()
    setAccessToken('не-jwt')
    await ensureFreshToken()
    expect(post).not.toHaveBeenCalled()
  })

  it('свой порог minMs учитывается', async () => {
    setAccessToken(jwt(600))
    await ensureFreshToken(30 * 60_000)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('если refresh не удался — отправляет на /login и пробрасывает ошибку', async () => {
    post.mockRejectedValue(new Error('401'))
    setAccessToken(null)
    await expect(ensureFreshToken()).rejects.toThrow('401')
    expect(window.location.href).toBe('/login')
  })
})
