import axios from 'axios'
import Cookies from 'js-cookie'
import { getJwtExpiry } from '@/lib/jwt'
import type { AuthTokens } from '@/types'

export function setAuthCookies(tokens: AuthTokens) {
  Cookies.set('access_token', tokens.access_token, { sameSite: 'strict', expires: getJwtExpiry(tokens.access_token) })
  Cookies.set('refresh_token', tokens.refresh_token, { sameSite: 'strict', expires: getJwtExpiry(tokens.refresh_token) })
}

function clearAuthCookies() {
  Cookies.remove('access_token')
  Cookies.remove('refresh_token')
}

export const apiClient = axios.create({
  baseURL: '/backend',
  headers: { 'Content-Type': 'application/json' },
  paramsSerializer: (params) => {
    const searchParams = new URLSearchParams()
    for (const [key, val] of Object.entries(params)) {
      if (val === undefined || val === null) continue
      if (Array.isArray(val)) {
        for (const item of val) searchParams.append(key, String(item))
      } else {
        searchParams.append(key, String(val))
      }
    }
    return searchParams.toString()
  },
})

apiClient.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Shared promise to prevent concurrent refresh races: all 401s (from axios or authorizedFetch) wait for a single refresh
let refreshPromise: Promise<AuthTokens> | null = null

async function refreshTokens(): Promise<string> {
  const refreshToken = Cookies.get('refresh_token')
  if (!refreshToken) {
    clearAuthCookies()
    window.location.href = '/login'
    throw new Error('No refresh token')
  }

  try {
    if (!refreshPromise) {
      refreshPromise = axios
        .post('/backend/auth/refresh', { refresh_token: refreshToken })
        .then((r) => r.data)
        .finally(() => { refreshPromise = null })
    }
    const data = await refreshPromise
    setAuthCookies(data)
    return data.access_token
  } catch (err) {
    refreshPromise = null
    clearAuthCookies()
    window.location.href = '/login'
    throw err
  }
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const accessToken = await refreshTokens()
        original.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(original)
      } catch {
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

// Для запросов, которым нужен сырой fetch (multipart upload, download) — та же
// логика refresh-and-retry на 401, с тем же общим refreshPromise, что и у axios.
export async function authorizedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const token = Cookies.get('access_token')
    return fetch(`/backend${path}`, {
      ...options,
      headers: { ...(options.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
  }

  let res = await doFetch()
  if (res.status === 401) {
    await refreshTokens()
    res = await doFetch()
  }
  return res
}
