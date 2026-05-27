'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import Cookies from 'js-cookie'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => {
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        set({ user: null })
      },
    }),
    { name: 'savt-auth' }
  )
)
