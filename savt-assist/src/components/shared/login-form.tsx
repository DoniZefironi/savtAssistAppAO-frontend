'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api/auth'
import { setAccessToken } from '@/lib/api/client'
import { apiErrorMessage } from '@/lib/api/errors'
import { useAuthStore } from '@/lib/store/auth'
import { isEndUserRole } from '@/lib/utils'

const MIN_PASSWORD = 8

export function LoginForm() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  // Токен для смены пароля при первом входе (must_change_password) держим
  // только в состоянии формы: панель ему не нужна — на любой запрос, кроме
  // смены пароля, сервер отвечает 403, а refresh-cookie в этом случае не ставится.
  const [changeToken, setChangeToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const loginVal = (fd.get('login') as string)?.trim() || login.trim()
    const passVal = (fd.get('password') as string) || password

    if (!loginVal || !passVal) return

    setLoading(true)
    try {
      const { access_token, user, must_change_password } = await authApi.login(loginVal, passVal)

      // Эндпоинт /auth/admin-login сам пропускает только персонал, поэтому роль
      // обычного пользователя сюда дойти не должна. Отсекаем её на всякий случай,
      // а операторов уводим в свою панель. Остальные staff-роли (admin, superadmin
      // и любые их варианты написания) — в админ-панель.
      if (isEndUserRole(user.role)) {
        toast.error('Доступ запрещён. Только для администраторов и операторов.')
        return
      }

      if (must_change_password) {
        setLogin(loginVal)
        setPassword(passVal)
        setNotice(null)
        setChangeToken(access_token)
        return
      }

      setAccessToken(access_token)
      setUser(user)

      if (user.role === 'operator') router.push('/operator/dashboard')
      else router.push('/admin/dashboard')
    } catch (err) {
      // /auth/admin-login ограничен 5 запросами в минуту — без разбора 429
      // пользователь после нескольких опечаток видел бы «неверный пароль»
      // и продолжал подбирать, хотя его уже придержали
      toast.error(apiErrorMessage(err, 'Неверный логин или пароль'))
    } finally {
      setLoading(false)
    }
  }

  if (changeToken) {
    return (
      <div className="bg-white/95 rounded-2xl shadow-2xl p-8">
        <ChangePasswordForm
          accessToken={changeToken}
          currentPassword={password}
          onDone={() => {
            // Бэкенд закрыл все сессии — возвращаемся к входу с тем же логином.
            setChangeToken(null)
            setPassword('')
            setShowPassword(false)
            setNotice('Пароль изменён. Войдите с новым паролем.')
          }}
          onCancel={() => { setChangeToken(null); setPassword('') }}
        />
      </div>
    )
  }

  return (
    <div className="bg-white/95 rounded-2xl shadow-2xl p-8">

      {notice && (
        <p className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{notice}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login" className="text-slate-600 text-sm">Логин</Label>
          <Input
            id="login"
            name="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="Номер телефона или логин"
            autoComplete="username"
            className="h-12 bg-slate-50 border-slate-200 focus-visible:border-[#4A8FE7] text-black"
          />
          <p className="text-xs text-slate-400">
            Сотрудникам логином служит номер телефона из Bitrix, например +375 29 111-22-33. Формат не важен.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-slate-600 text-sm">Пароль</Label>
          <PasswordInput
            id="password"
            name="password"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
            placeholder="Введите пароль"
            autoComplete="current-password"
          />
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

// Экран первой смены пароля: текущий, новый, подтверждение. Текущий пароль уже
// введён на входе, поэтому поле предзаполнено им (его можно поправить). Сервер
// проверяет остальные правила к паролю, его текст ошибки показываем как есть;
// на клиенте только длина и совпадение, чтобы не слать заведомо негодный запрос.
function ChangePasswordForm({ accessToken, currentPassword, onDone, onCancel }: {
  accessToken: string
  currentPassword: string
  onDone: () => void
  onCancel: () => void
}) {
  const [old, setOld] = useState(currentPassword)
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!old) { setError('Введите текущий пароль'); return }
    if (next.length < MIN_PASSWORD) { setError(`Пароль должен быть не короче ${MIN_PASSWORD} символов`); return }
    if (next !== confirm) { setError('Пароли не совпадают'); return }

    setSaving(true)
    setError(null)
    try {
      await authApi.changePassword(accessToken, old, next)
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err, 'Не удалось сменить пароль'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Задайте свой пароль</h2>
        <p className="text-sm text-slate-500 mt-1">
          Сейчас у вас общий начальный пароль. Пока вы его не смените, панель недоступна.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="old-password" className="text-slate-600 text-sm">Текущий пароль</Label>
        <PasswordInput
          id="old-password"
          name="old-password"
          value={old}
          onChange={(v) => { setOld(v); setError(null) }}
          show={show}
          onToggle={() => setShow(!show)}
          placeholder="Начальный пароль"
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password" className="text-slate-600 text-sm">Новый пароль</Label>
        <PasswordInput
          id="new-password"
          name="new-password"
          value={next}
          onChange={(v) => { setNext(v); setError(null) }}
          show={show}
          onToggle={() => setShow(!show)}
          placeholder={`Не короче ${MIN_PASSWORD} символов`}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password" className="text-slate-600 text-sm">Повторите пароль</Label>
        <PasswordInput
          id="confirm-password"
          name="confirm-password"
          value={confirm}
          onChange={(v) => { setConfirm(v); setError(null) }}
          show={show}
          onToggle={() => setShow(!show)}
          placeholder="Ещё раз"
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 wrap-break-word">{error}</p>
      )}

      <Button
        type="submit"
        disabled={saving || !next || !confirm}
        className="w-full h-12 bg-[#1B3A72] hover:bg-[#1B3A72]/90 text-white font-semibold rounded-xl cursor-pointer"
      >
        {saving ? 'Сохранение...' : 'Сменить пароль'}
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="w-full text-sm text-slate-500 hover:text-slate-700 cursor-pointer disabled:opacity-50"
      >
        Назад ко входу
      </button>
    </form>
  )
}

function PasswordInput({ id, name, value, onChange, show, onToggle, placeholder, autoComplete }: {
  id: string
  name: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder: string
  autoComplete: string
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="h-12 bg-slate-50 border-slate-200 focus-visible:border-[#4A8FE7] pr-10 text-black"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  )
}
