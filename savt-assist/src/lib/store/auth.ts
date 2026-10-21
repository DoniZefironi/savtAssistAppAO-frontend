'use client'

import { create } from 'zustand'
import type { User } from '@/types'
import { authApi } from '@/lib/api/auth'
import { setAccessToken } from '@/lib/api/client'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

// Профиль только в памяти: AuthBootstrap подтягивает его через /auth/me при
// каждой загрузке, а в localStorage он лишь раскрывал бы роль и данные при XSS.
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: async () => {
    try {
      await authApi.logout()
    } catch {}
    setAccessToken(null)
    set({ user: null })
    try { localStorage.removeItem('savt-auth') } catch { /* storage недоступен */ }
  },
}))
