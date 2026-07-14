import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  // access_token теперь живёт только в памяти клиента, поэтому единственный
  // сигнал авторизации, видимый middleware, — HttpOnly refresh_token cookie.
  // Присутствие не гарантирует валидность (это проверяет /api/auth/refresh на
  // клиенте при загрузке), но отсутствие однозначно означает разлогиненность.
  const refreshToken = request.cookies.get('refresh_token')?.value

  const isAuthPage = pathname === '/login'
  const isAdminPage = pathname.startsWith('/admin')
  const isOperatorPage = pathname.startsWith('/operator')
  const isProtected = isAdminPage || isOperatorPage

  if (!refreshToken && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (refreshToken && isAuthPage) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/login', '/admin/:path*', '/operator/:path*'],
}
