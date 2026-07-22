import { Fragment } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Общие для RequestsView (список + Addition/Share/DocumentRequest-диалогов) и
// ServiceDialog — вынесены сюда, а не в requests-view.tsx, чтобы ServiceDialog
// мог жить отдельным модулем и не тащить за собой весь список заявок
// (см. service-dialog.tsx и разбор циклического импорта cabinets/requests/users).

export function svcStatusCls(s: string) {
  return s === 'open'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : s === 'in_progress'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
}
export function svcStatusLabel(s: string) {
  return s === 'open' ? 'Открыта' : s === 'in_progress' ? 'В работе' : 'Закрыта'
}
export function reqStatusCls(s: string) {
  return s === 'pending'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : s === 'approved'
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}
export function reqStatusLabel(s: string) {
  return s === 'pending' ? 'Ожидает' : s === 'approved' ? 'Одобрена' : 'Отклонена'
}
export function reqTypeCls(t: string) {
  if (t === 'diagnostics') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  if (t === 'remote_adjustment') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  if (t === 'onsite_adjustment') return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
  if (t === 'other') return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
  return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
}
export function reqTypeLabel(t: string) {
  if (t === 'diagnostics') return 'Диагностика'
  if (t === 'remote_adjustment') return 'Наладка удалённо'
  if (t === 'onsite_adjustment') return 'Наладка с выездом'
  if (t === 'other') return 'Другое'
  return 'Ремонт'
}
export function userTypeLabel(t: string | null) {
  return t === 'organization' ? 'Организация' : 'Физ. лицо'
}
export function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function DRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    // На мобильном лейбл над значением — длинные слова («Зарегистрирован») иначе
    // переносились посреди слова при фикс. ширине колонки
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3">
      <span className="text-xs text-slate-400 sm:w-32 shrink-0 sm:pt-0.5">{label}</span>
      <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  )
}

export function DRowLink({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-left cursor-pointer"
    >
      <span className="text-xs text-slate-400 sm:w-32 shrink-0 sm:pt-0.5">{label}</span>
      <div className="flex-1 flex items-center gap-1 min-w-0">
        <span className="text-sm font-medium text-[#1B3A72] dark:text-blue-400 group-hover:underline underline-offset-2 truncate">{value}</span>
        <svg className="w-3 h-3 text-[#1B3A72]/40 dark:text-blue-400/40 shrink-0 group-hover:text-[#1B3A72] dark:group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  )
}

export function ModalTextarea({ value, onChange, placeholder, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:border-[#4A8FE7] dark:placeholder:text-slate-500"
    />
  )
}

export function DialogHeader({ icon, title, subtitle, badge }: {
  icon: React.ReactNode; title: string; subtitle: string; badge?: React.ReactNode
}) {
  return (
    <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg text-white leading-tight">{title}</p>
          <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>
          {badge && <div className="mt-2">{badge}</div>}
        </div>
      </div>
    </div>
  )
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      verified
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
    )}>
      {verified ? <><CheckCircle2 className="w-3 h-3" />Подтверждён</> : 'Не подтверждён'}
    </span>
  )
}

const SVC_STEPS = [
  { value: 'open' as const, label: 'Открыта' },
  { value: 'in_progress' as const, label: 'В работе' },
  { value: 'closed' as const, label: 'Закрыта' },
]

export function StatusStepper({ status, onChange }: {
  status: 'open' | 'in_progress' | 'closed'
  onChange: (s: 'open' | 'in_progress' | 'closed') => void
}) {
  const currentIndex = SVC_STEPS.findIndex(s => s.value === status)
  return (
    <div className="flex items-start w-full">
      {SVC_STEPS.map((step, i) => {
        const isActive = step.value === status
        const isDone = i < currentIndex
        return (
          <Fragment key={step.value}>
            <button
              onClick={() => onChange(step.value)}
              className="flex flex-col items-center gap-1.5 flex-1 cursor-pointer group"
            >
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center border-2 text-sm font-bold transition-all',
                isActive
                  ? 'bg-[#1B3A72] border-[#1B3A72] text-white scale-110 shadow-md shadow-[#1B3A72]/25'
                  : isDone
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-400 group-hover:border-[#4A8FE7] group-hover:text-[#4A8FE7]'
              )}>
                {isDone ? <CheckIcon className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-xs font-medium text-center leading-tight',
                isActive ? 'text-[#1B3A72] dark:text-blue-400' :
                isDone ? 'text-green-600 dark:text-green-400' :
                'text-slate-400 dark:text-slate-500'
              )}>
                {step.label}
              </span>
            </button>
            {i < SVC_STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mt-4.5 mx-1 transition-colors',
                i < currentIndex ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'
              )} />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
