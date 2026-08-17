'use client'

import { useMemo, useState } from 'react'
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

type AddMode = 'single' | 'multiBit' | 'import'

interface ParsedRow {
  line: number
  address: number | null
  bit: number | null
  name: string
  description: string | null
  error: string | null
}

interface RegisterGroup {
  address: number
  rows: RegisterRow[]
}

// Реальная карта — десятки адресов по 16 битов, флатом это стена из
// повторяющегося номера адреса в каждой строке. Группируем по адресу и
// показываем его один раз в шапке секции, а не в каждой строке.
function groupByAddress(items: RegisterRow[]): RegisterGroup[] {
  const map = new Map<number, RegisterRow[]>()
  for (const item of items) {
    const arr = map.get(item.address)
    if (arr) arr.push(item)
    else map.set(item.address, [item])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([address, rows]) => ({ address, rows: [...rows].sort((a, b) => a.bit - b.bit) }))
}

function parseImportText(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map((raw, i): ParsedRow | null => {
      const trimmed = raw.trim()
      if (!trimmed) return null
      const parts = (trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',')).map(p => p.trim())
      const [addrRaw = '', bitRaw = '', nameRaw = '', descRaw = ''] = parts
      const address = /^\d+$/.test(addrRaw) ? Number(addrRaw) : null
      const bit = /^\d+$/.test(bitRaw) ? Number(bitRaw) : null
      let error: string | null = null
      if (address === null) error = 'адрес должен быть числом'
      else if (bit === null || bit < 0 || bit > 15) error = 'бит должен быть числом 0-15'
      else if (!nameRaw) error = 'нет названия'
      return { line: i + 1, address, bit, name: nameRaw, description: descRaw || null, error }
    })
    .filter((r): r is ParsedRow => r !== null)
}

// Общая таблица «адрес / бит / название / описание» — используется и для
// стандартной карты регистров (глобальной), и для переопределений на
// конкретном ШУ (см. README-backend.md, «Рут admin: telemetry»). Разница
// между ними — только в том, что грузит/добавляет/удаляет строки родитель.
// Каждая строка карты — конкретный бит (0-15) конкретного адреса, оба поля
// обязательны на бэкенде.
//
// Реальные карты регистров — это десятки адресов по 16 битовых флагов
// каждый (сотни строк), поэтому кроме добавления по одной записи есть два
// режима массового ввода: все биты одного адреса разом и вставка из
// Excel/CSV. onAdd всегда получает массив — единичное добавление тоже
// оборачивается в массив из одного элемента, родитель отправляет по очереди
// одной пакетной мутацией.
export function RegisterMapTable({ items, isLoading, canEdit, onAdd, isAdding, onDelete, deletingId, emptyLabel }: {
  items: RegisterRow[]
  isLoading: boolean
  canEdit: boolean
  onAdd: (dtos: RegisterDto[]) => void
  isAdding: boolean
  onDelete: (id: number) => void
  deletingId: number | null
  emptyLabel: string
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggleExpanded = (addr: number) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(addr)) next.delete(addr)
    else next.add(addr)
    return next
  })

  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<AddMode>('single')

  // single
  const [address, setAddress] = useState('')
  const [bit, setBit] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // multiBit — один адрес, до 16 битов разом
  const [mbAddress, setMbAddress] = useState('')
  const [mbNames, setMbNames] = useState<string[]>(Array(16).fill(''))

  // import — вставка из таблицы
  const [importText, setImportText] = useState('')

  const [error, setError] = useState<string | null>(null)

  const searchLower = search.trim().toLowerCase()
  const filteredItems = searchLower
    ? items.filter(r => String(r.address).includes(searchLower) || r.name.toLowerCase().includes(searchLower))
    : items
  const groups = useMemo(() => groupByAddress(filteredItems), [filteredItems])
  // Пока идёт поиск — раскрываем всё найденное сразу, чтобы не приходилось
  // ещё и вручную кликать по каждой секции после фильтра.
  const isExpanded = (addr: number) => (searchLower ? true : expanded.has(addr))

  // Подсказка в режиме "один адрес, все биты" — какие биты этого адреса уже
  // заняты, чтобы не плодить дубликаты (адрес+бит уникален на бэкенде).
  const mbAddressNum = Number(mbAddress)
  const mbExistingBits = mbAddress.trim() && Number.isInteger(mbAddressNum)
    ? items.filter(r => r.address === mbAddressNum).map(r => r.bit).sort((a, b) => a - b)
    : []

  const reset = () => {
    setAddress(''); setBit(''); setName(''); setDescription('')
    setMbAddress(''); setMbNames(Array(16).fill(''))
    setImportText('')
    setError(null)
    setShowAdd(false)
    setMode('single')
  }

  const handleAddSingle = () => {
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
    onAdd([{ address: addressNum, bit: bitNum, name: name.trim(), description: description.trim() || null }])
  }

  const handleAddMultiBit = () => {
    const addressNum = Number(mbAddress)
    if (!mbAddress.trim() || !Number.isInteger(addressNum) || addressNum < 0) {
      setError('Укажите корректный адрес регистра')
      return
    }
    const dtos: RegisterDto[] = mbNames
      .map((n, bitNum) => ({ bitNum, name: n.trim() }))
      .filter(x => x.name)
      .map(x => ({ address: addressNum, bit: x.bitNum, name: x.name, description: null }))
    if (dtos.length === 0) {
      setError('Заполните название хотя бы для одного бита')
      return
    }
    setError(null)
    onAdd(dtos)
  }

  const parsedImport = useMemo(() => parseImportText(importText), [importText])
  const validImportRows = parsedImport.filter(r => !r.error)
  const invalidImportRows = parsedImport.filter(r => r.error)

  const handleImport = () => {
    if (validImportRows.length === 0) {
      setError('Нет ни одной корректной строки для импорта')
      return
    }
    setError(null)
    onAdd(validImportRows.map(r => ({ address: r.address!, bit: r.bit!, name: r.name, description: r.description })))
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
        <>
          {items.length > 8 && (
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="relative flex-1 max-w-xs">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Поиск по адресу или названию..."
                  className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-400">{groups.length} адресов, {filteredItems.length} записей</span>
                {!searchLower && (
                  <button
                    onClick={() => setExpanded(expanded.size === groups.length ? new Set() : new Set(groups.map(g => g.address)))}
                    className="text-xs text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {expanded.size === groups.length ? 'Свернуть всё' : 'Развернуть всё'}
                  </button>
                )}
              </div>
            </div>
          )}

          {groups.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">Ничего не найдено</p>
          ) : (
            <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/60">
              {groups.map(group => {
                const open = isExpanded(group.address)
                return (
                  <div key={group.address}>
                    <button
                      onClick={() => toggleExpanded(group.address)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
                    >
                      <ChevronIcon className={cn('w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
                      <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">Адрес {group.address}</span>
                      <span className="text-xs text-slate-400">
                        {group.rows.length === 1 ? group.rows[0].name : `${group.rows.length} ${group.rows.length < 5 ? 'записи' : 'записей'}`}
                      </span>
                    </button>
                    {open && (
                      <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                        {group.rows.map(row => (
                          <div key={row.id} className="grid grid-cols-[50px_1fr_1fr_auto] gap-2 pl-9 pr-3 py-2 items-center">
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
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {canEdit && (
        <div className="mt-3">
          {showAdd ? (
            <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-3">
              <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
                <ModeButton active={mode === 'single'} onClick={() => { setMode('single'); setError(null) }}>Одна запись</ModeButton>
                <ModeButton active={mode === 'multiBit'} onClick={() => { setMode('multiBit'); setError(null) }}>Один адрес, все биты</ModeButton>
                <ModeButton active={mode === 'import'} onClick={() => { setMode('import'); setError(null) }}>Импорт из таблицы</ModeButton>
              </div>

              {mode === 'single' && (
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
              )}

              {mode === 'multiBit' && (
                <div className="space-y-2">
                  <input
                    value={mbAddress}
                    onChange={e => { setMbAddress(e.target.value); setError(null) }}
                    placeholder="Адрес"
                    inputMode="numeric"
                    className="w-full sm:w-40 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                  />
                  <p className="text-xs text-slate-400">Заполните название только для тех битов, что нужны — пустые пропускаются</p>
                  {mbExistingBits.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">Уже есть в карте: бит {mbExistingBits.join(', ')}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {mbNames.map((val, i) => {
                      const taken = mbExistingBits.includes(i)
                      return (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className={cn('text-xs font-mono w-5 text-right shrink-0', taken ? 'text-amber-500' : 'text-slate-400')}>{i}</span>
                          <input
                            value={val}
                            onChange={e => {
                              const next = [...mbNames]; next[i] = e.target.value; setMbNames(next); setError(null)
                            }}
                            placeholder={taken ? 'занят' : '—'}
                            title={taken ? 'Этот бит уже описан в карте' : undefined}
                            className={cn(
                              'w-full px-2 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]',
                              taken ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-600'
                            )}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {mode === 'import' && (
                <div className="space-y-2">
                  <textarea
                    value={importText}
                    onChange={e => { setImportText(e.target.value); setError(null) }}
                    placeholder={'Вставьте из Excel/таблицы, по строке на регистр:\nадрес [Tab] бит [Tab] название [Tab] описание (необязательно)\nтакже понимает запятую вместо Tab'}
                    rows={6}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] font-mono resize-y"
                  />
                  {parsedImport.length > 0 && (
                    <div className="border border-slate-100 dark:border-slate-700/60 rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/60">
                        Готово к импорту: <span className="font-medium text-emerald-600 dark:text-emerald-400">{validImportRows.length}</span>
                        {invalidImportRows.length > 0 && <>, ошибок: <span className="font-medium text-red-500">{invalidImportRows.length}</span></>}
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700/30">
                        {parsedImport.map(r => (
                          <div key={r.line} className={cn('flex items-center gap-2 px-3 py-1 text-xs', r.error ? 'text-red-500' : 'text-slate-500 dark:text-slate-400')}>
                            <span className="font-mono text-slate-300 dark:text-slate-600 w-6 shrink-0">{r.line}</span>
                            {r.error ? (
                              <span className="truncate">строка не распознана: {r.error}</span>
                            ) : (
                              <span className="truncate font-mono">{r.address}.{r.bit} — {r.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={reset} disabled={isAdding} className="h-7 text-xs px-2 cursor-pointer">
                  Отмена
                </Button>
                {mode === 'single' && (
                  <Button onClick={handleAddSingle} disabled={isAdding} className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                    {isAdding ? 'Добавление...' : 'Добавить'}
                  </Button>
                )}
                {mode === 'multiBit' && (
                  <Button onClick={handleAddMultiBit} disabled={isAdding} className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                    {isAdding ? 'Добавление...' : 'Добавить'}
                  </Button>
                )}
                {mode === 'import' && (
                  <Button onClick={handleImport} disabled={isAdding || validImportRows.length === 0} className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                    {isAdding ? 'Импорт...' : `Импортировать${validImportRows.length > 0 ? ` (${validImportRows.length})` : ''}`}
                  </Button>
                )}
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

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap',
        active ? 'bg-white dark:bg-slate-700 text-[#1B3A72] dark:text-blue-400 shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
function ChevronIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
