'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { cabinetsApi } from '@/lib/api/cabinets'
import type { Cabinet } from '@/types'

interface Props {
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
  error?: string
}

function cabinetLabel(c: Cabinet): string {
  return c.admin_internal_name ? `${c.object_number} — ${c.admin_internal_name}` : c.object_number
}

// Поиск ШУ по номеру объекта/названию вместо ручного ввода ID — оператор обычно
// не знает числовой ID шкафа, только его номер объекта или название.
export function CabinetCombobox({ value, onChange, placeholder = 'Поиск по номеру объекта или названию...', error }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['cabinets-combobox', debouncedSearch],
    queryFn: () => cabinetsApi.getAll({ search: debouncedSearch || undefined, size: 20, sort_by: 'object_number', sort_order: 'asc' }),
    enabled: open,
  })
  const items = data?.items ?? []

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (c: Cabinet) => {
    onChange(c.id)
    setSelectedLabel(cabinetLabel(c))
    setSearch('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={open ? search : selectedLabel}
          onChange={(e) => {
            setSearch(e.target.value)
            if (value !== null) onChange(null)
            setSelectedLabel('')
          }}
          onFocus={() => { setOpen(true); setSearch('') }}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'w-full px-3 py-2 pr-8 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400',
            error
              ? 'border-red-400 focus:border-red-500 dark:border-red-500'
              : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
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
          {isFetching && <div className="px-3 py-2 text-xs text-slate-400">Поиск...</div>}
          {!isFetching && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>
          )}
          {items.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex flex-col gap-0.5"
            >
              <span className="text-slate-700 dark:text-slate-200 font-medium">{cabinetLabel(c)}</span>
              {c.type && <span className="text-xs text-slate-400">{c.type}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
