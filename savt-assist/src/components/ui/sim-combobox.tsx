'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { simApi } from '@/lib/api/sim'
import type { SimInfoOut } from '@/types'

interface Props {
  value: number | null
  valueLabel?: string | null
  onChange: (id: number | null) => void
  placeholder?: string
}

function simLabel(s: SimInfoOut): string {
  return s.name || s.phone || s.serial_number || `SIM #${s.id}`
}

// Поиск SIM по названию — тот же паттерн, что у ProjectCombobox (плюс кнопка
// отвязки). Ручка /admin/sim умеет фильтровать ещё по phone/serial_number/ip,
// но один общий поисковый инпут сюда заводит только name — самое человекочитаемое
// поле для быстрого поиска (см. name в SimInfoOut).
export function SimCombobox({ value, valueLabel, onChange, placeholder = 'Поиск SIM по названию...' }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(valueLabel ?? '')
  const ref = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['sim', 'combobox', debouncedSearch],
    queryFn: () => simApi.getAll({ name: debouncedSearch || undefined, size: 20 }),
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

  const handleSelect = (s: SimInfoOut) => {
    onChange(s.id)
    setSelectedLabel(simLabel(s))
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
            title="Отвязать SIM"
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
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100">
          {isFetching && <div className="px-3 py-2 text-xs text-slate-400">Поиск...</div>}
          {!isFetching && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>
          )}
          {items.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex flex-col gap-0.5"
            >
              <span className="text-slate-700 dark:text-slate-200 font-medium">{simLabel(s)}</span>
              {(s.phone || s.serial_number) && (
                <span className="text-xs text-slate-400">{[s.phone, s.serial_number].filter(Boolean).join(' · ')}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
