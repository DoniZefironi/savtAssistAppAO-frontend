'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { authApi } from '@/lib/api/auth'
import { setAccessToken } from '@/lib/api/client'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: async () => {
        try {
          await authApi.logout()
        } catch {}
        setAccessToken(null)
        set({ user: null })
      },
    }),
    { name: 'savt-auth' }
  )
)
