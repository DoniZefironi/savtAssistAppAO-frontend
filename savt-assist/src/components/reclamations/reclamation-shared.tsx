import type { ReclamationObjectType, ReclamationStatus } from '@/types'

// Подписи — ровно те же, что у соответствующих стадий в Bitrix (см.
// README-backend.md, «Статусы и стадии Bitrix»): статус и стадия теперь одно
// и то же, и админ с профильным специалистом должны называть их одинаково.
export function reclStatusCls(s: ReclamationStatus): string {
  if (s === 'new') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  if (s === 'review') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (s === 'resolved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (s === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  // invalid — не «решение по рекламации», а «это вообще не рекламация»,
  // поэтому нейтральный серый, а не красный, как у отклонённой.
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
}
export function reclStatusLabel(s: ReclamationStatus): string {
  if (s === 'new') return 'Новая рекламация'
  if (s === 'review') return 'На рассмотрении'
  if (s === 'in_progress') return 'Принята в работу'
  if (s === 'resolved') return 'Закрыта'
  if (s === 'rejected') return 'Отклонена'
  return 'Ошибочная'
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
