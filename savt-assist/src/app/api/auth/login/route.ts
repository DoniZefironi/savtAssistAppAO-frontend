import { NextResponse } from 'next/server'
import axios from 'axios'
import { API_URL } from '@/lib/api/base-url'
import { refreshCookieOptions } from '../cookie-options'
import type { AuthTokens } from '@/types'

// BFF route: логинится на бэкенде, кладёт refresh_token в HttpOnly cookie
// (недоступную для браузерного JS) и отдаёт клиенту только access_token + user.
export async function POST(request: Request) {
  const { login, password } = await request.json()

  try {
    const { data: tokens } = await axios.post<AuthTokens>(`${API_URL}/auth/admin-login`, { login, password })
    const { data: user } = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    const res = NextResponse.json({ access_token: tokens.access_token, user })
    res.cookies.set('refresh_token', tokens.refresh_token, refreshCookieOptions(tokens.refresh_token))
    return res
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return NextResponse.json(err.response.data ?? { detail: 'Ошибка входа' }, { status: err.response.status })
    }
    return NextResponse.json({ detail: 'Ошибка входа' }, { status: 502 })
  }
}
