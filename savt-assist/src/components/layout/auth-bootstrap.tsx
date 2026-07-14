'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { setAccessToken } from '@/lib/api/client'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'

// access_token живёт только в памяти вкладки, поэтому при каждой полной
// перезагрузке страницы его нужно восстановить: молча обмениваем HttpOnly
// refresh_token cookie на новый access_token и синхронизируем профиль,
// прежде чем показывать защищённый контент (иначе запросы уйдут без токена).
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const { data } = await axios.post<{ access_token: string }>('/api/auth/refresh')
        setAccessToken(data.access_token)
        const user = await authApi.me()
        if (cancelled) return
        setUser(user)
        setReady(true)
      } catch {
        if (cancelled) return
        setUser(null)
        router.replace('/login')
      }
    }

    bootstrap()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-[#1B3A72] animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
