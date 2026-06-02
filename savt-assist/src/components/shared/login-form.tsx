'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Cookies from 'js-cookie'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api/auth'
import { useAuthStore } from '@/lib/store/auth'

export function LoginForm() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login.trim() || !password) return

    setLoading(true)
    try {
      const tokens = await authApi.login(login.trim(), password)
      Cookies.set('access_token', tokens.access_token, { sameSite: 'strict' })
      Cookies.set('refresh_token', tokens.refresh_token, { sameSite: 'strict' })

      const user = await authApi.me()
      setUser(user)

      if (user.role === 'admin') router.push('/admin/dashboard')
      else if (user.role === 'operator') router.push('/operator/dashboard')
      else toast.error('Доступ запрещён. Только для администраторов и операторов.')
    } catch {
      toast.error('Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-xl font-bold text-center text-slate-800 mb-1">Вход в аккаунт</h2>
      <p className="text-sm text-slate-400 text-center mb-7">Введите логин и пароль</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login" className="text-slate-600 text-sm">Логин</Label>
          <Input
            id="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Введите логин"
            autoComplete="username"
            className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#4A8FE7]"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-600 text-sm">Пароль</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
              className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-[#4A8FE7] pr-10"
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
