'use client'

import { cn } from '@/lib/utils'

interface Props {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}

// Пилюля-переключатель (фильтр статуса, сортировка, выбор области и т.п.) —
// раньше один и тот же className собирался инлайново в каждом списке заново.
export function PillButton({ active, onClick, children, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
        active
          ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
        className
      )}
    >
      {children}
    </button>
  )
}
