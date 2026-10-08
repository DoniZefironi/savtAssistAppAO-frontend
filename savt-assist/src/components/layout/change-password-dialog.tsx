'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { PasswordField } from '@/components/ui/form-field'
import { authApi } from '@/lib/api/auth'
import { apiErrorMessage } from '@/lib/api/errors'
import { useAuthStore } from '@/lib/store/auth'

const MIN_PASSWORD = 8

// Смена собственного пароля (POST /auth/password-change). После успеха бэкенд
// закрывает все сессии, в том числе эту, поэтому сразу выходим и отправляем на
// вход заново — иначе следующий же запрос ответил бы 401.
export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current) { setError('Введите текущий пароль'); return }
    if (next.length < MIN_PASSWORD) { setError(`Новый пароль должен быть не короче ${MIN_PASSWORD} символов`); return }
    if (next === current) { setError('Новый пароль должен отличаться от текущего'); return }
    if (next !== confirm) { setError('Пароли не совпадают'); return }

    setSaving(true)
    setError(null)
    try {
      await authApi.changePassword(current, next)
    } catch (err) {
      // Неверный текущий пароль и правила к новому — текстом с сервера.
      setError(apiErrorMessage(err, 'Не удалось сменить пароль'))
      setSaving(false)
      return
    }
    await logout()
    toast.success('Пароль изменён. Войдите заново с новым паролем.')
    router.push('/login')
  }

  return (
    <AppModal open onClose={saving ? () => {} : onClose} className="sm:max-w-md">
      <form onSubmit={handleSubmit} className="min-w-0">
        <div className="flex items-center gap-3 px-5 pr-14 py-4 text-white bg-linear-to-r from-[#4A8FE7] to-[#1B3A72]">
          <KeyRound className="w-5 h-5 shrink-0" />
          <h3 className="text-base font-semibold">Смена пароля</h3>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <PasswordField label="Текущий пароль" value={current} onChange={(v) => { setCurrent(v); setError(null) }} autoComplete="current-password" />
          <PasswordField label="Новый пароль" hint={`не короче ${MIN_PASSWORD} символов`} value={next} onChange={(v) => { setNext(v); setError(null) }} />
          <PasswordField label="Повторите новый пароль" value={confirm} onChange={(v) => { setConfirm(v); setError(null) }} />

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 wrap-break-word">{error}</p>
          )}
          <p className="text-xs text-slate-400">После смены вы выйдете из системы на всех устройствах и войдёте заново.</p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving} className="cursor-pointer">Отмена</Button>
          <Button
            type="submit"
            disabled={saving || !current || !next || !confirm}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 text-white cursor-pointer"
          >
            {saving ? 'Сохранение...' : 'Сменить пароль'}
          </Button>
        </div>
      </form>
    </AppModal>
  )
}
