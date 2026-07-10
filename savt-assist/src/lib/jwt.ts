// Читает claim exp из JWT, чтобы срок жизни cookie совпадал с реальным сроком
// жизни токена на бэкенде, вместо того чтобы хардкодить TTL на фронте.
export function getJwtExpiry(token: string): Date | undefined {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (typeof json.exp === 'number') return new Date(json.exp * 1000)
  } catch {}
  return undefined
}
