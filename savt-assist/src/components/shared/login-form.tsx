'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api/auth'
import { setAuthCookies } from '@/lib/api/client'
import { useAuthStore } from '@/lib/store/auth'
import { isEndUserRole } from '@/lib/utils'

export function LoginForm() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const loginVal = (fd.get('login') as string)?.trim() || login.trim()
    const passVal = (fd.get('password') as string) || password

    if (!loginVal || !passVal) return

    setLoading(true)
    try {
      const tokens = await authApi.login(loginVal, passVal)
      setAuthCookies(tokens)

      const user = await authApi.me()

      // Эндпоинт /auth/admin-login сам пропускает только персонал, поэтому роль
      // обычного пользователя сюда дойти не должна. Отсекаем её на всякий случай,
      // а операторов уводим в свою панель. Остальные staff-роли (admin, superadmin
      // и любые их варианты написания) — в админ-панель.
      if (isEndUserRole(user.role)) {
        toast.error('Доступ запрещён. Только для администраторов и операторов.')
        return
      }

      setUser(user)

      if (user.role === 'operator') router.push('/operator/dashboard')
      else router.push('/admin/dashboard')
    } catch {
      toast.error('Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/95 rounded-2xl shadow-2xl p-8">

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login" className="text-slate-600 text-sm">Логин</Label>
          <Input
            id="login"
            name="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Введите логин"
            autoComplete="username"
            className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#4A8FE7] text-black"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-600 text-sm">Пароль</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#4A8FE7] pr-10 text-black"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#1B3A72] hover:bg-[#1B3A72]/90 text-white font-semibold rounded-xl mt-2 cursor-pointer"
        >
          {loading ? 'Вход...' : 'Войти'}
        </Button>
      </form>
    </div>
  )
}
