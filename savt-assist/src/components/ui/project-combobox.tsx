'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { projectsApi } from '@/lib/api/projects'
import type { Project } from '@/types'

interface Props {
  value: number | null
  valueLabel?: string | null
  onChange: (id: number | null) => void
  placeholder?: string
}

// Поиск проекта по названию, аналогично CabinetCombobox — плюс явная кнопка
// сброса, т.к. отвязка ШУ от проекта (project_id: null) такое же валидное
// действие, как и выбор конкретного проекта.
export function ProjectCombobox({ value, valueLabel, onChange, placeholder = 'Поиск проекта по названию...' }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(valueLabel ?? '')
  const ref = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['projects-combobox', debouncedSearch],
    queryFn: () => projectsApi.getAll({ search: debouncedSearch || undefined, size: 20, sort_by: 'name', sort_order: 'asc' }),
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

  const handleSelect = (p: Project) => {
    onChange(p.id)
    setSelectedLabel(p.name)
    setSearch('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setSelectedLabel('')
    setSearch('')
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
          className="w-full px-3 py-2 pr-14 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]"
        />
        {!open && value !== null && (
          <button
            type="button"
            onClick={handleClear}
            title="Отвязать от проекта"
            className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
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
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(p)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex flex-col gap-0.5"
            >
              <span className="text-slate-700 dark:text-slate-200 font-medium">{p.name}</span>
              <span className="text-xs text-slate-400">{p.cabinet_count} шкафов</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
