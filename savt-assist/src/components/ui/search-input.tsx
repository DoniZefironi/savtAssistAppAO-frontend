'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { SearchIcon } from './icons'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

// Поиск с лупой слева и крестиком очистки справа — раньше копировался
// одинаково в каждый список (заявки/пользователи/проекты/шкафы/журнал).
export function SearchInput({ value, onChange, placeholder, className }: Props) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 focus-visible:ring-[#4A8FE7]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
