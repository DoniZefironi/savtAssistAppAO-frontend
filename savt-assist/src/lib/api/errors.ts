import { isAxiosError } from 'axios'

// Бэкенд отдаёт ошибки единым JSON `{ "detail": "<текст для пользователя>" }`
// на всех кодах, кроме 422: там `detail` — массив объектов {loc, msg, type} от
// pydantic, и показывать его как есть нельзя (см. README-backend.md,
// «Формат ошибок и лимиты запросов»).
//
// Лимиты по IP довольно жёсткие (например, /auth/admin-login — 5/мин), поэтому
// 429 разбирается отдельно: без этого пользователь после нескольких опечаток
// видел бы «неверный пароль» и продолжал долбить, не понимая, что его придержали.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!isAxiosError(err)) return fallback

  if (err.response?.status === 429) {
    return 'Слишком много попыток. Подождите минуту и попробуйте снова'
  }

  const detail: unknown = err.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail

  // 422 — массив pydantic; собственного текста для пользователя в нём нет
  if (Array.isArray(detail)) return 'Проверьте правильность заполнения полей'

  if (err.response == null) return 'Нет связи с сервером'

  return fallback
}
