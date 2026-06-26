import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Нормализует роль к виду без разделителей/регистра: 'Super_Admin' -> 'superadmin'. */
function normalizeRole(role?: string | null) {
  return (role ?? '').toLowerCase().replace(/[_\-\s]/g, '')
}

/** Устойчиво к написанию роли с бэкенда (superadmin / super_admin / super-admin / SUPERADMIN). */
export function isSuperadminRole(role?: string | null) {
  return normalizeRole(role) === 'superadmin'
}

/** Конечный пользователь (не персонал). */
export function isEndUserRole(role?: string | null) {
  return normalizeRole(role) === 'user'
}
