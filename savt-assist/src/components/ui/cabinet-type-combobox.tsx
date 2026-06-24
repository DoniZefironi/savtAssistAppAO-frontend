'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tagsApi } from '@/lib/api/tags'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}

export function CabinetTypeCombobox({ value, onChange, placeholder = 'Вентиляция', error }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  const { data: tags = [] } = useQuery({
    queryKey: ['tags', 'cabinet_type'],
    queryFn: () => tagsApi.getAll('cabinet_type'),
  })

  useEffect(() => {
    setSearch(value)
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = tags.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const exactMatch = tags.some(t =>
    t.name.toLowerCase() === search.toLowerCase().trim()
  )

  const showCreate = search.trim().length > 0 && !exactMatch
  const showDropdown = open && (filtered.length > 0 || showCreate)

  const handleSelect = (name: string) => {
    onChange(name)
    setSearch(name)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          value={search}
          onChange={handleInputChange}
          onClick={() => setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-3 pr-7',
            error
              ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
              : 'border-input focus-visible:border-ring focus-visible:ring-ring/50'
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

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-white border dark:bg-gray-900 border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(tag => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(tag.name)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center justify-between gap-2 first:rounded-t-lg"
            >
              <span>{tag.name}</span>
              {value.toLowerCase() === tag.name.toLowerCase() && (
                <Check size={13} className="text-blue-600 shrink-0" />
              )}
            </button>
          ))}

          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(search.trim())}
              className={cn(
                'w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1.5 last:rounded-b-lg',
                filtered.length > 0 && 'border-t border-slate-100'
              )}
            >
              <Plus size={13} />
              Создать «{search.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  )
}
