import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import axios from 'axios'
import { API_URL } from '@/lib/api/base-url'
import { refreshCookieOptions } from '../cookie-options'
import type { AuthTokens } from '@/types'

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
    const { data: tokens } = await axios.post<AuthTokens>(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })

    const res = NextResponse.json({ access_token: tokens.access_token })
    res.cookies.set('refresh_token', tokens.refresh_token, refreshCookieOptions(tokens.refresh_token, request))
    return res
  } catch {
    const res = NextResponse.json({ detail: 'Refresh failed' }, { status: 401 })
    res.cookies.delete('refresh_token')
    return res
  }
}
