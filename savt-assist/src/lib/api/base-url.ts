// Единственное место, где задаётся адрес бэкенда.
// Переопределяется через NEXT_PUBLIC_API_URL в .env.local; строка ниже — только фолбэк.
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://helper.savt.by'

// Абсолютный URL для файлов бэкенда (например /static/photos/abc.jpg)
export function toFullUrl(url: string): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_URL}${url}`
}
