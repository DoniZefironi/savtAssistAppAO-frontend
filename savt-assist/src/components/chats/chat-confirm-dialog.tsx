'use client'

interface Props {
  title: string
  body: string
  label: string
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ChatConfirmDialog({ title, body, label, pending, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors cursor-pointer">
            {pending ? '...' : label}
          </button>
        </div>
      </div>
    </div>
  )
}
