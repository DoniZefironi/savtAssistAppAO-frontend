import axios from 'axios'

// access_token живёт только в памяти вкладки (не в cookie/localStorage) — при
// перезагрузке страницы он теряется и восстанавливается через silent-refresh
// по HttpOnly refresh_token cookie (см. AuthBootstrap). Так access_token не
// достаётся XSS-инъекции через document.cookie/localStorage.
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
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
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// Shared promise to prevent concurrent refresh races: all 401s (from axios or authorizedFetch) wait for a single refresh.
// Обращается к /api/auth/refresh — Next.js route handler, который читает HttpOnly
// refresh_token cookie на сервере (недоступную из браузерного JS) и обновляет её.
let refreshPromise: Promise<string> | null = null

export async function refreshTokens(): Promise<string> {
  try {
    if (!refreshPromise) {
      refreshPromise = axios
        .post<{ access_token: string }>('/api/auth/refresh')
        .then((r) => r.data.access_token)
        .finally(() => { refreshPromise = null })
    }
    const newAccessToken = await refreshPromise
    accessToken = newAccessToken
    return newAccessToken
  } catch (err) {
    accessToken = null
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
        const newAccessToken = await refreshTokens()
        original.headers.Authorization = `Bearer ${newAccessToken}`
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
    return fetch(`/backend${path}`, {
      ...options,
      headers: { ...(options.headers ?? {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    })
  }

  let res = await doFetch()
  if (res.status === 401) {
    await refreshTokens()
    res = await doFetch()
  }
  return res
}
