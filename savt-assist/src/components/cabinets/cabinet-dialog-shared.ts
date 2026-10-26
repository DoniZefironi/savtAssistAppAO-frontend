export function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Лимиты и форматы — по README-backend.md (POST /upload/attachment, POST /admin/kb/articles/{id}/attachments).
const DOC_MAX_SIZE = 500 * 1024 * 1024
const DOC_ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]
export const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.mov'

export function validateDocFile(file: File): string | null {
  if (!DOC_ALLOWED_TYPES.includes(file.type)) return 'Недопустимый формат файла (PDF, Word, Excel, изображение или видео mp4/mov)'
  if (file.size > DOC_MAX_SIZE) return `Файл слишком большой (максимум ${fmtSize(DOC_MAX_SIZE)})`
  return null
}

// Документы в админке (POST /admin/documents): любые типы, кроме исполняемых и
// сценариев (иначе 415), размер до 500 МБ (иначе 413) — проверяем до отправки.
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'msi', 'bat', 'cmd', 'scr', 'dll', 'lnk', 'js', 'vbs', 'ps1', 'jar', 'apk', 'sh',
  'com', 'pif', 'reg', 'wsf', 'vbe', 'jse', 'msp', 'cpl', 'hta',
])

export function validateAdminDocFile(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (BLOCKED_EXTENSIONS.has(ext)) return `Файлы .${ext} загружать нельзя (исполняемые и сценарии запрещены)`
  if (file.size > DOC_MAX_SIZE) return `Файл слишком большой (максимум ${fmtSize(DOC_MAX_SIZE)})`
  return null
}

const PHOTO_MAX_SIZE = 500 * 1024 * 1024

export function validatePhotoFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Файл должен быть изображением'
  if (file.size > PHOTO_MAX_SIZE) return `Файл слишком большой (максимум ${fmtSize(PHOTO_MAX_SIZE)})`
  return null
}
