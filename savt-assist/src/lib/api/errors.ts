import { isAxiosError } from 'axios'

// Ошибка fetch-запроса (загрузки идут через fetch, а не axios): несёт код ответа и,
// если тело было JSON, текст `detail`. HTML-страницу (413 от nginx) не парсим.
export class HttpError extends Error {
  constructor(public status: number, public detail?: unknown) {
    super(typeof detail === 'string' ? detail : `HTTP ${status}`)
    this.name = 'HttpError'
  }
}

export async function httpErrorFromResponse(res: Response): Promise<HttpError> {
  let detail: unknown
  if (res.headers.get('content-type')?.includes('application/json')) {
    detail = await res.json().then((b) => b?.detail).catch(() => undefined)
  }
  return new HttpError(res.status, detail)
}

const TOO_LARGE = 'Слишком большой запрос'
const UNAVAILABLE = 'Сервис временно недоступен, попробуйте ещё раз через минуту'
const CHECK_FIELDS = 'Проверьте поля формы'

function messageFor(status: number | undefined, detail: unknown, fallback: string): string {
  if (status === 429) return 'Слишком много попыток. Подождите минуту и попробуйте снова'
  // 413 приходит HTML-страницей от nginx, а не JSON: detail там нет
  if (status === 413) return TOO_LARGE
  if (typeof detail === 'string' && detail.trim()) return detail
  // 422 — массив pydantic; собственного текста для пользователя в нём нет
  if (Array.isArray(detail)) return CHECK_FIELDS
  if (status === 502 || status === 503 || status === 504) return UNAVAILABLE
  return fallback
}

// Бэкенд отдаёт ошибки единым JSON `{ "detail": "<текст для пользователя>" }`
// на всех кодах, кроме 422: там `detail` — массив объектов {loc, msg, type} от
// pydantic, и показывать его как есть нельзя (см. README-backend.md,
// «Формат ошибок и лимиты запросов»).
//
// Лимиты по IP довольно жёсткие (например, /auth/admin-login — 5/мин), поэтому
// 429 разбирается отдельно: без этого пользователь после нескольких опечаток
// видел бы «неверный пароль» и продолжал долбить, не понимая, что его придержали.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError) return messageFor(err.status, err.detail, fallback)
  if (!isAxiosError(err)) return fallback
  if (err.response == null) return 'Нет связи с сервером'
  return messageFor(err.response.status, err.response.data?.detail, fallback)
}

// Ошибки 422 по полям: ключ — последний элемент loc (имя поля тела запроса),
// значение — сообщение валидатора. Для подсветки конкретных полей формы.
// Не 422 или нет loc — пустой объект, форма остаётся с общим текстом.
export function apiFieldErrors(err: unknown): Record<string, string> {
  if (!isAxiosError(err) || err.response?.status !== 422) return {}
  const detail: unknown = err.response.data?.detail
  if (!Array.isArray(detail)) return {}
  const out: Record<string, string> = {}
  for (const item of detail) {
    const loc: unknown = item?.loc
    if (!Array.isArray(loc) || loc.length === 0) continue
    const field = String(loc[loc.length - 1])
    if (!(field in out)) out[field] = typeof item.msg === 'string' ? item.msg : CHECK_FIELDS
  }
  return out
}
