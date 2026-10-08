import axios from 'axios'
import { apiClient } from './client'
import type { User } from '@/types'

export const authApi = {
  // Идёт через Next.js route handler (/api/auth/login), а не напрямую на бэкенд:
  // refresh_token оседает там в HttpOnly cookie и никогда не попадает в браузерный JS.
  login: async (login: string, password: string): Promise<{ access_token: string; user: User }> => {
    const { data } = await axios.post<{ access_token: string; user: User }>('/api/auth/login', { login, password })
    return data
  },

  // Смена собственного пароля. Бэкенд проверяет текущий, требует минимум 8
  // символов и отличие нового от старого, и после успеха закрывает ВСЕ сессии
  // пользователя — вызывающий обязан отправить его на вход заново.
  changePassword: async (password: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/password-change', {
      password,
      new_password: newPassword,
      new_password_confirm: newPassword,
    })
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  logout: async (): Promise<void> => {
    await axios.post('/api/auth/logout')
  },
}
