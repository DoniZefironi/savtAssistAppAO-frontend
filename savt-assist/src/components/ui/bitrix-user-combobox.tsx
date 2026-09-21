'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClickOutside } from '@/lib/hooks/use-click-outside'
import type { ReclamationBitrixUser } from '@/types'

interface Props {
  users: ReclamationBitrixUser[]
  isLoading?: boolean
  isError?: boolean
  onChange: (user: ReclamationBitrixUser) => void
  placeholder?: string
}

// Поиск по «Ответственному» для рекламаций — в отличие от CabinetCombobox/
// SimCombobox/ProjectCombobox, список сюда приходит уже целиком одним
// запросом (GET /admin/reclamations/bitrix-users не постраничный и без
// параметра поиска, см. README-backend.md) — сотрудников компании немного,
// поэтому фильтрация на клиенте по уже загруженному списку, без запроса на
// каждый ввод. Всегда стартует пустым (не принимает value/valueLabel) — это
// поле «назначить/сменить», а не отображение уже назначенного (та строка —
// отдельно, над комбобоксом, см. reclamation-dialog.tsx).
export function BitrixUserCombobox({ users, isLoading, isError, onChange, placeholder = 'Поиск по ФИО или должности...' }: Props) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState('')
  // Само поле обычно оказывается у самого низа модалки (блок «Обработка», см.
  // reclamation-dialog.tsx), а у модалки overflow-hidden (нужен для скруглённых
  // углов её шапки) — выпадающий список внутри неё обрезался бы. Рендерим его
  // порталом прямо в body с position:fixed по координатам инпута — тот же
  // приём, что и у самой AppModal (createPortal), полностью снимает эту
  // зависимость от overflow предков, где бы комбобокс ни оказался.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useClickOutside([wrapRef, listRef], () => setOpen(false))

  useEffect(() => {
    if (!open) return
    const update = () => {
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    update()
    // capture:true — ловит скролл любого вложенного контейнера-предка
    // (например, внутренней прокрутки модалки), не только document/window.
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  const items = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    // ?? '' — часть записей из Bitrix приходит с пустыми full_name/position
    // (незаполненный профиль сотрудника, не только у уволенных/гостевых
    // аккаунтов, которые раньше отсекал снятый на бэкенде фильтр USER_TYPE).
    return users.filter(u => (u.full_name ?? '').toLowerCase().includes(q) || (u.position ?? '').toLowerCase().includes(q))
  }, [users, search])

  const handleSelect = (u: ReclamationBitrixUser) => {
    onChange(u)
    setSelectedLabel(u.full_name || `Bitrix-пользователь #${u.id}`)
    setSearch('')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          value={open ? search : selectedLabel}
          onChange={(e) => { setSearch(e.target.value); setSelectedLabel('') }}
          onFocus={() => { setOpen(true); setSearch('') }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 pr-8 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]"
        />
        <ChevronDown
          size={14}
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform',
            open && 'rotate-180'
          )}
        />
      </div>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {isLoading && <div className="px-3 py-2 text-xs text-slate-400">Загрузка...</div>}
          {isError && <div className="px-3 py-2 text-xs text-red-500">Не удалось загрузить список из Bitrix</div>}
          {!isLoading && !isError && items.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">Ничего не найдено</div>
          )}
          {items.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(u)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex flex-col gap-0.5"
            >
              <span className="text-slate-700 dark:text-slate-200 font-medium">{u.full_name || `Bitrix-пользователь #${u.id}`}</span>
              {(u.position || u.phone) && (
                <span className="text-xs text-slate-400">{[u.position, u.phone].filter(Boolean).join(' · ')}</span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
