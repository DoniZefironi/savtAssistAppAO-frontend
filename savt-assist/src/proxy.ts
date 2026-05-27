import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('access_token')?.value

  const isAuthPage = pathname === '/login'
  const isAdminPage = pathname.startsWith('/admin')
  const isOperatorPage = pathname.startsWith('/operator')
  const isProtected = isAdminPage || isOperatorPage

  if (!accessToken && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (accessToken && isAuthPage) {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/login', '/admin/:path*', '/operator/:path*'],
}
