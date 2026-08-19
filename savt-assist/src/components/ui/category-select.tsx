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
export function CategorySelect({ categories, value, onChange, disabled, placeholder = 'Поиск по категориям...', error }: {
  categories: CategoryLike[]
  value: number
  onChange: (id: number) => void
  disabled?: boolean
  placeholder?: string
  error?: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = categories.find(c => c.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const searchLower = search.trim().toLowerCase()
  const filtered = searchLower
    ? categories.filter(c => c.name.toLowerCase().includes(searchLower))
    : categories

  const handleSelect = (c: CategoryLike) => {
    onChange(c.id)
    setSearch('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={open ? search : (selected ? categoryLabel(selected) : '')}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => { if (!disabled) { setOpen(true); setSearch('') } }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={cn(
            'w-full px-3 py-2 pr-8 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-default',
            error ? 'border-red-400 focus:border-red-500 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
          )}
        />
        <ChevronDown
          size={14}
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform',
            open && 'rotate-180'
          )}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => handleSelect(c)}
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
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
