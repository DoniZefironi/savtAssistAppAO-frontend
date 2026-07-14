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

// Secure-cookie браузер молча не сохранит, если реальное соединение идёт по http
// (напр. переходный режим без TLS, см. README-backend.md). NODE_ENV=production
// сам по себе ничего не говорит о схеме — в Docker он захардкожен в образе и
// остаётся 'production', даже когда nginx перед приложением ещё отдаёт голый
// http. Поэтому смотрим на X-Forwarded-Proto от прокси (стандартный заголовок
// nginx/трафика), и только если его нет вовсе (нет прокси, голый `next start`)
// — откатываемся на NODE_ENV как раньше.
function isRequestSecure(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto')
  if (proto) return proto === 'https'
  return process.env.NODE_ENV === 'production'
}

export function refreshCookieOptions(refreshToken: string, request: Request) {
  return {
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: 'strict' as const,
    path: '/',
    maxAge: getJwtExpirySeconds(refreshToken),
  }
}
