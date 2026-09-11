'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { RegisterDto, RegisterPatchDto } from '@/lib/api/registers'
import { SearchIcon, PlusIcon } from '@/components/ui/icons'

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

const BIT_COUNT = 16

// Общий grid-template для шапки таблицы и каждой строки адреса — колонки
// одной ширины что там, что там, поэтому всё выравнивается по вертикали.
// 380px под биты — 16 квадратов по 20px (w-5) с гэпом 4px (gap-1) между ними.
// Колонка «Биты» скрыта в узком контейнере (display:none выкидывает её из
// потока грида), поэтому там всего 3 колонки вместо 4.
//
// @lg (контейнерный, не sm:) — эта таблица используется и на всю ширину
// страницы (register-definitions-view.tsx), и внутри узкой модалки ШУ
// (max-w-lg ≈ 512px, вкладка «Переопределения карты»). sm: реагирует на
// ширину ОКНА браузера, а не модалки — на обычном десктопном окне (>640px)
// он включал бы этот 380-пиксельный столбец битов и внутри модалки тоже,
// хотя реальной ширины там ему взяться неоткуда — верстка ехала. @lg:
// реагирует на ширину самого контейнера (см. @container на корневом div
// ниже), поэтому в модалке остаётся компактный вид, а на полной странице —
// прежний, десктопный.
const GROUP_ROW_GRID = 'grid grid-cols-[90px_1fr_auto] @lg:grid-cols-[90px_380px_1fr_auto] gap-3 items-center'

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

function hexAddress(addr: number): string {
  return '0x' + addr.toString(16).toUpperCase().padStart(4, '0')
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

// CSV — целиком на клиенте: getDefinitions() и так отдаёт все строки разом
// (без пагинации), поэтому экспорт не требует отдельного запроса. ﻿ —
// BOM, без него Excel по умолчанию показывает кириллицу битым текстом.
function exportCsv(items: RegisterRow[]) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const rows = [...items]
    .sort((a, b) => a.address - b.address || a.bit - b.bit)
    .map(r => [String(r.address), String(r.bit), escape(r.name), escape(r.description ?? '')].join(','))
  const csv = '﻿' + ['Адрес,Бит,Название,Описание', ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'register-map.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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
//
// Адрес как таковой не хранится на бэкенде отдельной сущностью — он «есть»,
// пока у него есть хотя бы один описанный бит. Сетка битов в шапке группы —
// не живые значения телеметрии (эта карта общая для всех ШУ, а не для одного
// конкретного — живые значения показывает отдельная панель «Сырая
// телеметрия» с собственным выбором ШУ), а то, какие биты вообще описаны:
// клик по пустому квадрату открывает форму добавления именно этого бита,
// клик по заполненному — редактирование уже существующего.
export function RegisterMapTable({ items, isLoading, canEdit, onAdd, isAdding, onUpdate, updatingId, onDelete, deletingId, emptyLabel }: {
  items: RegisterRow[]
  isLoading: boolean
  canEdit: boolean
  // true — всё отправленное реально добавилось, форма очищается и остаётся
  // открытой (готова к следующему адресу). false — были ошибки (например,
  // 409 на дубликат адрес+бит) — оставляем как есть, чтобы можно было
  // поправить и отправить заново, не перепечатывая всё с нуля.
  onAdd: (dtos: RegisterDto[]) => Promise<boolean>
  isAdding: boolean
  // true — сохранилось, редактирование строки закрывается. false — ошибка
  // (например, увели бит в уже занятый на этом адресе) — оставляем как есть.
  onUpdate: (id: number, dto: RegisterPatchDto) => Promise<boolean>
  updatingId: number | null
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
  const [mbNames, setMbNames] = useState<string[]>(Array(BIT_COUNT).fill(''))

  // import — вставка из таблицы
  const [importText, setImportText] = useState('')

  const [error, setError] = useState<string | null>(null)

  // Редактирование существующей строки на месте (PATCH) — адрес не трогаем
  // здесь: строка живёт внутри шапки своего адреса, смена адреса перенесла
  // бы её в другую группу, для этого проще удалить и добавить заново.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBit, setEditBit] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const startEdit = (row: RegisterRow) => {
    setEditingId(row.id)
    setEditBit(String(row.bit))
    setEditName(row.name)
    setEditDescription(row.description ?? '')
    setEditError(null)
  }
  const cancelEdit = () => { setEditingId(null); setEditError(null) }

  // Клик по заполненному квадрату в сетке битов — раскрыть группу и сразу
  // войти в редактирование этого бита, не заставляя искать его в списке строк.
  const editBitFromGrid = (addr: number, row: RegisterRow) => {
    setExpanded(prev => new Set(prev).add(addr))
    startEdit(row)
  }

  const saveEdit = async (row: RegisterRow) => {
    const bitNum = Number(editBit)
    if (!editBit.trim() || !Number.isInteger(bitNum) || bitNum < 0 || bitNum > 15) {
      setEditError('Бит должен быть числом от 0 до 15')
      return
    }
    if (!editName.trim()) {
      setEditError('Укажите название')
      return
    }
    setEditError(null)
    const ok = await onUpdate(row.id, { bit: bitNum, name: editName.trim(), description: editDescription.trim() || null })
    // Функциональное обновление с проверкой row.id — пока сохранение этой
    // строки летело, могли успеть открыть редактирование другой строки
    // (editingId уже указывает на неё); тогда закрывать чужую форму нельзя.
    if (ok) setEditingId(current => (current === row.id ? null : current))
  }

  const searchLower = search.trim().toLowerCase()
  const filteredItems = searchLower
    ? items.filter(r =>
        String(r.address).includes(searchLower) ||
        String(r.bit).includes(searchLower) ||
        r.name.toLowerCase().includes(searchLower) ||
        (r.description ?? '').toLowerCase().includes(searchLower)
      )
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
    setMbAddress(''); setMbNames(Array(BIT_COUNT).fill(''))
    setImportText('')
    setError(null)
    setShowAdd(false)
    setMode('single')
  }

  const openCreate = () => {
    setAddress(''); setBit(''); setName(''); setDescription('')
    setError(null)
    setMode('single')
    setShowAdd(true)
  }

  const openImport = () => {
    setImportText('')
    setError(null)
    setMode('import')
    setShowAdd(true)
  }

  // Клик по пустому квадрату в сетке битов — сразу открыть форму с уже
  // подставленными адресом и битом, остаётся вписать только название.
  const openQuickAddBit = (addr: number, bitNum: number) => {
    setMode('single')
    setAddress(String(addr))
    setBit(String(bitNum))
    setName('')
    setDescription('')
    setError(null)
    setShowAdd(true)
  }

  const handleAddSingle = async () => {
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
    const ok = await onAdd([{ address: addressNum, bit: bitNum, name: name.trim(), description: description.trim() || null }])
    if (ok) { setAddress(''); setBit(''); setName(''); setDescription('') }
  }

  const handleAddMultiBit = async () => {
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
    const ok = await onAdd(dtos)
    if (ok) { setMbAddress(''); setMbNames(Array(BIT_COUNT).fill('')) }
  }

  const parsedImport = useMemo(() => parseImportText(importText), [importText])
  const validImportRows = parsedImport.filter(r => !r.error)
  const invalidImportRows = parsedImport.filter(r => r.error)

  const handleImport = async () => {
    if (validImportRows.length === 0) {
      setError('Нет ни одной корректной строки для импорта')
      return
    }
    setError(null)
    const ok = await onAdd(validImportRows.map(r => ({ address: r.address!, bit: r.bit!, name: r.name, description: r.description })))
    if (ok) setImportText('')
  }

  // Удаление адреса целиком — все его биты разом. onDelete не отдаёт промис
  // (родитель просто запускает мутацию), поэтому просто отправляем удаление
  // по каждой строке — каждая сама покажет свой спиннер через deletingId.
  // Подтверждение нативным confirm(), а не отдельной модалкой — действие
  // необратимо и затрагивает сразу до 16 строк, а такого узла подтверждения
  // в этом компоненте больше нигде нет, заводить его ради одной кнопки не стоит.
  const handleDeleteAddress = (group: RegisterGroup) => {
    const word = group.rows.length === 1 ? 'бит' : 'бит(ов)'
    if (!window.confirm(`Удалить адрес ${hexAddress(group.address)} и все ${group.rows.length} ${word}?`)) return
    for (const row of group.rows) onDelete(row.id)
  }

  if (isLoading) {
    return (
      <div className="space-y-2 px-6 py-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="@container px-4 sm:px-6 py-4">
      {/* Поиск, счётчик и кнопки — всегда наверху, а не под таблицей: при
          сотнях строк (десятки адресов по 16 битов) внизу их было не найти
          без прокрутки мимо всего списка. */}
      {(canEdit || items.length > 0) && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Адрес, номер бита или описание"
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 whitespace-nowrap">{groups.length} адресов, {filteredItems.length} записей</span>
            {!searchLower && groups.length > 0 && (
              <button
                onClick={() => setExpanded(expanded.size === groups.length ? new Set() : new Set(groups.map(g => g.address)))}
                className="text-xs text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap"
              >
                {expanded.size === groups.length ? 'Свернуть всё' : 'Развернуть всё'}
              </button>
            )}
            {items.length > 0 && (
              <Button variant="outline" onClick={() => exportCsv(items)} className="h-8 text-xs px-3 cursor-pointer">
                <ExportIcon className="w-3.5 h-3.5 mr-1.5" /> Экспорт CSV
              </Button>
            )}
            {canEdit && !showAdd && (
              <>
                <Button variant="outline" onClick={openImport} className="h-8 text-xs px-3 cursor-pointer">
                  <ImportIcon className="w-3.5 h-3.5 mr-1.5" /> Импорт
                </Button>
                <Button onClick={openCreate} className="h-8 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                  <PlusIcon className="w-3.5 h-3.5 mr-1.5" /> Создать регистр
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {canEdit && showAdd && (
        <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl p-3 space-y-3 mb-3">
          <div className="flex gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
            <ModeButton active={mode === 'single'} onClick={() => { setMode('single'); setError(null) }}>Одна запись</ModeButton>
            <ModeButton active={mode === 'multiBit'} onClick={() => { setMode('multiBit'); setError(null) }}>Один адрес, все биты</ModeButton>
            <ModeButton active={mode === 'import'} onClick={() => { setMode('import'); setError(null) }}>Импорт из таблицы</ModeButton>
          </div>

          {mode === 'single' && (
            <div className="grid grid-cols-1 @lg:grid-cols-[70px_50px_1fr_1fr] gap-2">
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
                className="w-full @lg:w-40 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              />
              <p className="text-xs text-slate-400">Заполните название только для тех битов, что нужны — пустые пропускаются</p>
              {mbExistingBits.length > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Уже есть в карте: бит {mbExistingBits.join(', ')}</p>
              )}
              <div className="grid grid-cols-2 @lg:grid-cols-4 gap-2">
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
      )}

      {items.length === 0 && !showAdd ? (
        <p className="text-sm text-slate-400 italic text-center py-6">{emptyLabel}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">Ничего не найдено</p>
      ) : (
        <div className="border border-slate-100 dark:border-slate-700/60 rounded-xl overflow-hidden">
          {/* Табличная шапка — задаёт те же колонки (те же фикс. ширины), что
              и каждая строка адреса ниже, чтобы всё выравнивалось по вертикали. */}
          <div className={cn(GROUP_ROW_GRID, 'px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700/60')}>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Адрес</span>
            <span className="hidden @lg:block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Биты</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Описание</span>
            {canEdit && <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 text-right">Действия</span>}
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {groups.map(group => {
              const open = isExpanded(group.address)
              return (
                <div key={group.address}>
                  <div className={cn(GROUP_ROW_GRID, 'px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors')}>
                    <button
                      onClick={() => toggleExpanded(group.address)}
                      className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                    >
                      <ChevronIcon className={cn('w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform', open && 'rotate-90')} />
                      <span className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">{hexAddress(group.address)}</span>
                    </button>
                    <div className="hidden @lg:flex">
                      <BitGrid
                        rows={group.rows}
                        canEdit={canEdit}
                        onAddBit={bitNum => openQuickAddBit(group.address, bitNum)}
                        onEditBit={row => editBitFromGrid(group.address, row)}
                      />
                    </div>
                    <button onClick={() => toggleExpanded(group.address)} className="text-left min-w-0 cursor-pointer">
                      <span className="text-xs text-slate-400 truncate block">
                        {group.rows.length === 1 ? group.rows[0].name : `${group.rows.length} ${group.rows.length < 5 ? 'записи' : 'записей'}`}
                      </span>
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleDeleteAddress(group)}
                        title="Удалить адрес целиком"
                        className="justify-self-end w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className="p-3 bg-slate-50/60 dark:bg-slate-800/30 grid grid-cols-1 @lg:grid-cols-2 @5xl:grid-cols-3 gap-2">
                      {group.rows.map(row => {
                        const isRowEditing = editingId === row.id
                        const isRowUpdating = updatingId === row.id
                        if (isRowEditing) {
                          return (
                            <div key={row.id} className="rounded-lg border border-[#4A8FE7] dark:border-blue-500 bg-white dark:bg-slate-900 p-2 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400 shrink-0">Бит</span>
                                <input
                                  value={editBit}
                                  onChange={e => { setEditBit(e.target.value); setEditError(null) }}
                                  inputMode="numeric"
                                  className="w-14 px-2 py-1 text-sm font-mono rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                                />
                              </div>
                              <input
                                value={editName}
                                onChange={e => { setEditName(e.target.value); setEditError(null) }}
                                placeholder="Название"
                                className="w-full px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                              />
                              <input
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                placeholder="Описание"
                                className="w-full px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                              />
                              {editError && <p className="text-xs text-red-500">{editError}</p>}
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => saveEdit(row)}
                                  disabled={isRowUpdating}
                                  title="Сохранить"
                                  className="w-7 h-7 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <CheckIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={isRowUpdating}
                                  title="Отмена"
                                  className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div key={row.id} className="flex items-center gap-2 rounded-lg border border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 px-2.5 py-1.5 min-w-0">
                            <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 shrink-0">
                              {row.bit}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{row.name}</p>
                              {row.description && <p className="text-xs text-slate-400 truncate">{row.description}</p>}
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  onClick={() => startEdit(row)}
                                  title="Редактировать"
                                  className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer"
                                >
                                  <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDelete(row.id)}
                                  disabled={deletingId === row.id}
                                  title="Удалить"
                                  className="w-6 h-6 rounded hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Сетка из 16 квадратов (по числу битов слова) в шапке адреса — не значения
// телеметрии (эта карта общая для всех ШУ), а какие биты вообще описаны.
// Заполненный — клик открывает редактирование этого бита, пустой (только
// если можно редактировать) — клик сразу открывает форму добавления именно
// этого бита с уже подставленными адресом и номером.
function BitGrid({ rows, canEdit, onAddBit, onEditBit }: {
  rows: RegisterRow[]
  canEdit: boolean
  onAddBit: (bit: number) => void
  onEditBit: (row: RegisterRow) => void
}) {
  const byBit = new Map(rows.map(r => [r.bit, r]))
  return (
    <div className="flex gap-1">
      {Array.from({ length: BIT_COUNT }, (_, i) => {
        const row = byBit.get(i)
        if (row) {
          return (
            <button
              key={i}
              type="button"
              onClick={e => { e.stopPropagation(); onEditBit(row) }}
              title={`Бит ${i}: ${row.name}`}
              className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono bg-[#1B3A72] hover:bg-[#1B3A72]/80 text-white dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors cursor-pointer"
            >
              {i}
            </button>
          )
        }
        if (!canEdit) {
          return <span key={i} className="w-5 h-5 rounded border border-slate-100 dark:border-slate-800" />
        }
        return (
          <button
            key={i}
            type="button"
            onClick={e => { e.stopPropagation(); onAddBit(i) }}
            title={`Добавить бит ${i}`}
            className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono border border-dashed border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-700 hover:border-[#4A8FE7] hover:text-[#4A8FE7] transition-colors cursor-pointer"
          >
            {i}
          </button>
        )
      })}
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

function ChevronIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
function PencilIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
}
function ImportIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
}
function ExportIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 7.5L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
}
