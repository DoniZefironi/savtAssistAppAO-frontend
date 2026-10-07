import axios from 'axios'
import { apiClient } from './client'
import type { User } from '@/types'

export const authApi = {
  // Идёт через Next.js route handler (/api/auth/login), а не напрямую на бэкенд:
  // refresh_token оседает там в HttpOnly cookie и никогда не попадает в браузерный JS.
  login: async (login: string, password: string): Promise<{ access_token: string; user: User; must_change_password: boolean }> => {
    const { data } = await axios.post<{ access_token: string; user: User; must_change_password?: boolean }>('/api/auth/login', { login, password })
    return { ...data, must_change_password: data.must_change_password === true }
  },

  // Смена пароля при первом входе. Намеренно голый axios с явным токеном, а не
  // apiClient: у apiClient на 401 включается refresh и редирект на /login, а
  // здесь refresh-cookie ещё нет (см. api/auth/login/route.ts), и любая ошибка
  // (например, 401 на неверный текущий пароль) должна просто показаться в форме.
  // После успеха бэкенд закрывает ВСЕ сессии — входить нужно заново.
  changePassword: async (accessToken: string, password: string, newPassword: string): Promise<void> => {
    await axios.post(
      '/backend/auth/password-change',
      { password, new_password: newPassword, new_password_confirm: newPassword },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  logout: async (): Promise<void> => {
    await axios.post('/api/auth/logout')
  },
}
