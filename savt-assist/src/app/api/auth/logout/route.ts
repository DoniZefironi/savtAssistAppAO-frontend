import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import axios from 'axios'
import { API_URL } from '@/lib/api/base-url'

// Инвалидирует refresh_token на бэкенде (best-effort) и стирает HttpOnly cookie.
export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('refresh_token')?.value

  if (refreshToken) {
    try {
      await axios.post(`${API_URL}/auth/logout`, { refresh_token: refreshToken })
    } catch {}
  }

  const res = new NextResponse(null, { status: 204 })
  res.cookies.delete('refresh_token')
  return res
}
