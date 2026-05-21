import { apiClient } from './client'
import type { AuthTokens, User } from '@/types'

export const authApi = {
  login: async (login: string, password: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post<AuthTokens>('/auth/admin-login', { login, password })
    return data
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/auth/logout', { refresh_token: refreshToken })
  },
}
