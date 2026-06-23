import axios from 'axios'
import Cookies from 'js-cookie'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://helper.savt.by'

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Shared promise to prevent concurrent refresh races: all 401s wait for a single refresh
let refreshPromise: Promise<{ access_token: string; refresh_token: string }> | null = null

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = Cookies.get('refresh_token')

      if (!refreshToken) {
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
            .then((r) => r.data)
            .finally(() => { refreshPromise = null })
        }
        const data = await refreshPromise
        Cookies.set('access_token', data.access_token, { sameSite: 'strict' })
        Cookies.set('refresh_token', data.refresh_token, { sameSite: 'strict' })
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch {
        refreshPromise = null
        Cookies.remove('access_token')
        Cookies.remove('refresh_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)
