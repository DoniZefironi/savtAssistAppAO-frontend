// Читает claim exp из JWT на сервере, чтобы срок жизни refresh_token cookie
// совпадал с реальным сроком жизни токена на бэкенде, вместо хардкода TTL.
function getJwtExpirySeconds(token: string): number | undefined {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
    if (typeof json.exp !== 'number') return undefined
    return Math.max(json.exp - Math.floor(Date.now() / 1000), 0)
  } catch {
    return undefined
  }
}

export function refreshCookieOptions(refreshToken: string) {
  return {
    httpOnly: true,
    // Локальная разработка (nginx.dev.conf) идёт по http — secure-cookie браузер
    // тогда просто не примет. В проде (nginx.conf, только https) — всегда secure.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: getJwtExpirySeconds(refreshToken),
  }
}
