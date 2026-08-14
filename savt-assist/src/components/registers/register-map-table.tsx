'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { RegisterDto } from '@/lib/api/registers'

interface RegisterRow {
  id: number
  address: number
  bit: number
  name: string
  description: string | null
}

// Общая таблица «адрес / бит / название / описание» — используется и для
// стандартной карты регистров (глобальной), и для переопределений на
// конкретном ШУ (см. README-backend.md, «Рут admin: telemetry»). Разница
// между ними — только в том, что грузит/добавляет/удаляет строки родитель.
// Каждая строка карты — конкретный бит (0-15) конкретного адреса, оба поля
// обязательны на бэкенде.
export function RegisterMapTable({ items, isLoading, canEdit, onAdd, isAdding, onDelete, deletingId, emptyLabel }: {
  items: RegisterRow[]
  isLoading: boolean
  canEdit: boolean
  onAdd: (dto: RegisterDto) => void
  isAdding: boolean
  onDelete: (id: number) => void
  deletingId: number | null
  emptyLabel: string
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [address, setAddress] = useState('')
  const [bit, setBit] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setAddress('')
    setBit('')
    setName('')
    setDescription('')
    setError(null)
    setShowAdd(false)
  }

  const handleAdd = () => {
    const addressNum = Number(address)
    if (!address.trim() || !Number.isInteger(addressNum) || addressNum < 0) {
      setError('Укажите корректный адрес регистра')
      return
    }
    const bitNum = Number(bit)
    if (!bit.trim() || !Number.isInteger(bitNum) || bitNum < 0 || bitNum > 15) {
      setError('Бит должен быть числом от 0 до 15')
      return
    }
    if (!name.trim()) {
      setError('Укажите название')
      return
    }
    setError(null)
    onAdd({ address: addressNum, bit: bitNum, name: name.trim(), description: description.trim() || null })
  }

  if (isLoading) {
    return (
      <div className="space-y-2 px-6 py-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-4">
      {items.length === 0 && !showAdd ? (
        <p className="text-sm text-slate-400 italic text-center py-6">{emptyLabel}</p>
      ) : (
        <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[70px_50px_1fr_1fr_auto] gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-medium text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
            <span>Адрес</span>
            <span>Бит</span>
            <span>Название</span>
            <span>Описание</span>
            <span className="w-7" />
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
            {items.map(row => (
              <div key={row.id} className="grid grid-cols-[70px_50px_1fr_1fr_auto] gap-2 px-3 py-2.5 items-center">
                <span className="text-sm font-mono text-slate-700 dark:text-slate-200">{row.address}</span>
                <span className="text-sm font-mono text-slate-400">{row.bit}</span>
                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{row.name}</span>
                <span className="text-sm text-slate-400 truncate">{row.description || '—'}</span>
                {canEdit ? (
                  <button
                    onClick={() => onDelete(row.id)}
                    disabled={deletingId === row.id}
                    title="Удалить"
                    className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                ) : <span className="w-7" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="mt-3">
          {showAdd ? (
            <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-[70px_50px_1fr_1fr] gap-2">
                <input
                  value={address}
                  onChange={e => { setAddress(e.target.value); setError(null) }}
                  placeholder="Адрес"
                  inputMode="numeric"
                  className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
                <input
                  value={bit}
                  onChange={e => { setBit(e.target.value); setError(null) }}
                  placeholder="Бит 0-15"
                  inputMode="numeric"
                  className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null) }}
                  placeholder="Название"
                  className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Описание (необязательно)"
                  className="px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={reset} disabled={isAdding} className="h-7 text-xs px-2 cursor-pointer">
                  Отмена
                </Button>
                <Button onClick={handleAdd} disabled={isAdding} className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                  {isAdding ? 'Добавление...' : 'Добавить'}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className={cn(
                'flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer'
              )}
            >
              <PlusIcon className="w-3.5 h-3.5" /> Добавить регистр
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
