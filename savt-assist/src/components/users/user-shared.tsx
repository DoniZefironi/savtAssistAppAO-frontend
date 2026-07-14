import { isSuperadminRole } from '@/lib/utils'

// Общие для UsersView (список) и UserDialog (карточка) — вынесены сюда, а не
// в один из этих файлов, чтобы UserDialog мог жить отдельным модулем и не тащить
// за собой весь список (см. user-dialog.tsx).
export function roleLabel(r: string) {
  if (isSuperadminRole(r)) return 'Суперадмин'
  if (r === 'admin') return 'Администратор'
  if (r === 'operator') return 'Оператор'
  return 'Пользователь'
}

export function userTypeLabel(t: string | null) {
  if (t === 'organization') return 'Организация'
  if (t === 'individual') return 'Физ. лицо'
  return t ?? '—'
}

export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    // На мобильном лейбл над значением (не колонка фикс. ширины) — длинные слова вроде
    // «Зарегистрирован» иначе переносились посреди слова, налезая на значение
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3">
      <span className="text-xs text-slate-400 sm:w-32 shrink-0 sm:pt-0.5">{label}</span>
      <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}

export function UserIcon() {
  return <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
}
