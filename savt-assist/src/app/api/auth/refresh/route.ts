import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import axios from 'axios'
import { API_URL } from '@/lib/api/base-url'
import { refreshCookieOptions } from '../cookie-options'
import type { AuthTokens } from '@/types'

// refresh_token одноразовый: бэкенд отзывает переданный и выдаёт новую пару, а
// повторную попытку с уже отозванным трактует как компрометацию и обрывает ВСЕ
// сессии пользователя (см. README-backend.md, «Обновление сессии»).
//
// Single-flight на клиенте (lib/api/client.ts) живёт в памяти вкладки и от
// параллельных вкладок не спасает: у каждой свой промис, но cookie одна на всех,
// поэтому обе отправят один и тот же токен — одна обновится, вторую выкинет
// вместе со всеми остальными сессиями. Схлопываем такие запросы здесь: все
// вкладки ходят через один и тот же Next-сервер, так что общего in-flight по
// значению токена достаточно.
const inFlight = new Map<string, Promise<AuthTokens>>()

// Результат держим ещё немного после ответа: вкладка могла отправить запрос со
// старым токеном за миг до того, как cookie обновилась, и прийти к нам уже
// после завершения первой ротации — ей нужно отдать ту же новую пару, а не идти
// на бэкенд с отозванным токеном.
const HOLD_RESULT_MS = 15_000

function refreshOnce(refreshToken: string): Promise<AuthTokens> {
  const existing = inFlight.get(refreshToken)
  if (existing) return existing

  const pending = axios
    .post<AuthTokens>(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then(r => r.data)

  inFlight.set(refreshToken, pending)
  pending.then(
    () => setTimeout(() => inFlight.delete(refreshToken), HOLD_RESULT_MS),
    // Ошибку не держим: сессия всё равно невосстановима, а следующий заход
    // должен получить честный ответ бэкенда, а не закэшированный отказ
    () => inFlight.delete(refreshToken),
  )
  return pending
}

// Silent refresh: читает HttpOnly refresh_token cookie на сервере (клиентский JS
// её прочитать не может), меняет пару токенов на бэкенде, перевыставляет cookie
// и возвращает клиенту только новый access_token.
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ detail: 'No refresh token' }, { status: 401 })
  }

  try {
    const tokens = await refreshOnce(refreshToken)

    const res = NextResponse.json({ access_token: tokens.access_token })
    res.cookies.set('refresh_token', tokens.refresh_token, refreshCookieOptions(tokens.refresh_token, request))
    return res
  } catch {
    const res = NextResponse.json({ detail: 'Refresh failed' }, { status: 401 })
    res.cookies.delete('refresh_token')
    return res
  }
}
