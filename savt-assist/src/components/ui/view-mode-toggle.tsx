'use client'

import { SlidersHorizontal } from 'lucide-react'
import { ListIcon, GridIcon } from './icons'

export type ViewMode = 'list' | 'grid'

interface Props {
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  // Третья кнопка (показать/скрыть поиск и фильтры) — опциональна: показываем
  // только если оба пропа переданы.
  filtersOpen?: boolean
  onToggleFilters?: () => void
  // p-1.5 у FAQ/КБ (иконка компактнее рядом с деревом категорий), p-2 везде
  // остальном — так было в исходных копиях, сохраняем разницу.
  size?: 'sm' | 'md'
}

// Тройка кнопок «Список / Сетка / Фильтры» — раньше копировалась под каждый
// экран (requests/users/projects/cabinets/faq/kb) с идентичной разметкой.
export function ViewModeToggle({ view, onViewChange, filtersOpen, onToggleFilters, size = 'md' }: Props) {
  const pad = size === 'sm' ? 'p-1.5' : 'p-2'
  const btnCls = (active: boolean) =>
    `${pad} transition-colors cursor-pointer ${active ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`

  return (
    <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button onClick={() => onViewChange('list')} title="Список" className={btnCls(view === 'list')}>
        <ListIcon />
      </button>
      <button onClick={() => onViewChange('grid')} title="Сетка" className={`${btnCls(view === 'grid')} border-l border-slate-200 dark:border-slate-700`}>
        <GridIcon />
      </button>
      {filtersOpen !== undefined && onToggleFilters && (
        <button
          onClick={onToggleFilters}
          title={filtersOpen ? 'Скрыть поиск и фильтры' : 'Показать поиск и фильтры'}
          className={`${btnCls(filtersOpen)} border-l border-slate-200 dark:border-slate-700`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
