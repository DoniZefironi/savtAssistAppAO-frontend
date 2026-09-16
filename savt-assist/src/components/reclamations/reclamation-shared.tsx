import type { ReclamationObjectType, ReclamationStatus } from '@/types'

export function reclStatusCls(s: ReclamationStatus): string {
  if (s === 'review') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (s === 'resolved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}
export function reclStatusLabel(s: ReclamationStatus): string {
  if (s === 'review') return 'На рассмотрении'
  if (s === 'in_progress') return 'В работе'
  if (s === 'resolved') return 'Исполнено'
  return 'Отклонена'
}

export function reclObjectTypeLabel(t: ReclamationObjectType): string {
  if (t === 'cabinet') return 'ШУ'
  if (t === 'line') return 'Автоматическая линия'
  if (t === 'component') return 'ПКИ'
  if (t === 'software') return 'ПО'
  return 'Документация'
}

// Гарантийная классификация — отдельное от статуса поле (см.
// README-backend.md, «Рут reclamations»): null, пока не классифицирована.
export function reclWarrantyLabel(w: boolean | null): string {
  return w == null ? 'Не классифицирована' : w ? 'Гарантийный случай' : 'Платно'
}
export function reclWarrantyCls(w: boolean | null): string {
  if (w == null) return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
  return w
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
}
