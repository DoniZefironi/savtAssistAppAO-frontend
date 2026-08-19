'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryLike {
  id: number
  name: string
  parent_id: number | null
}

function categoryLabel(c: CategoryLike): string {
  return c.parent_id ? `└ ${c.name}` : c.name
}

// Категория — поиском по уже загрученному (клиентскому) списку, а не обычный
// <select>: список категорий в базе знаний/ЧаВо со временем растёт, и щёлкать
// по нативному выпадающему списку в поисках нужной становится неудобно.
export function CategorySelect({ categories, value, onChange, disabled, placeholder = 'Выберите категорию', error }: {
  categories: CategoryLike[]
  value: number
  onChange: (id: number) => void
  disabled?: boolean
  placeholder?: string
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = categories.find(c => c.id === value)
  const searchLower = search.trim().toLowerCase()
  const filtered = searchLower
    ? categories.filter(c => c.name.toLowerCase().includes(searchLower))
    : categories

  const handleSelect = (id: number) => {
    onChange(id)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none transition-colors',
          disabled ? 'opacity-60 cursor-default' : 'cursor-pointer',
          error ? 'border-red-400 focus:border-red-500 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
        )}
      >
        <span className={cn('truncate', !selected && 'text-slate-400')}>
          {selected ? categoryLabel(selected) : placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-slate-100 dark:border-slate-700">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по категориям..."
              className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelect(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer',
                    c.id === value ? 'text-[#1B3A72] dark:text-blue-400 font-medium bg-slate-50 dark:bg-slate-700/50' : 'text-slate-700 dark:text-slate-200'
                  )}
                >
                  {categoryLabel(c)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
