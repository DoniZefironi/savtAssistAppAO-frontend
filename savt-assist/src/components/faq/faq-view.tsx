'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { faqApi } from '@/lib/api/faq'
import type { FaqCategory, FaqEntry } from '@/lib/api/faq'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/lib/store/auth'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

type SortValue = 'created_at' | 'updated_at' | 'question'

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'created_at', label: 'По дате' },
  { value: 'updated_at', label: 'По изменению' },
  { value: 'question', label: 'По вопросу' },
]

interface DeleteConfirm {
  type: 'category' | 'entry'
  id: number
  name: string
  warning?: string
}

export function FaqView() {
  const currentUser = useAuthStore(s => s.user)
  const isReadOnly = currentUser?.role === 'operator'
  const qc = useQueryClient()
  const sentinelRef = useRef<HTMLDivElement>(null)

  const CAT_DEFAULT = 208
  const CAT_MAX = 360
  const CAT_SNAP = 56
  const [panelWidth, setPanelWidth] = useState(CAT_DEFAULT)
  const [isSnapping, setIsSnapping] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const next = Math.max(0, Math.min(CAT_MAX, dragStartWidth.current + e.clientX - dragStartX.current))
      setPanelWidth(next)
    }
    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setPanelWidth(w => {
        if (w < CAT_SNAP) { setIsSnapping(true); setTimeout(() => setIsSnapping(false), 200); return 0 }
        return w
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [])

  const expandPanel = () => { setIsSnapping(true); setPanelWidth(CAT_DEFAULT); setTimeout(() => setIsSnapping(false), 200) }

  const [view, setView] = useState<'list' | 'grid'>('list')
  useEffect(() => {
    const saved = localStorage.getItem('view-mode-faq')
    if (saved === 'list' || saved === 'grid') setView(saved)
  }, [])
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [editEntry, setEditEntry] = useState<FaqEntry | null>(null)
  const [createEntryOpen, setCreateEntryOpen] = useState(false)
  const [createCatOpen, setCreateCatOpen] = useState(false)
  const [createCatParentId, setCreateCatParentId] = useState<number | null>(null)
  const [editCat, setEditCat] = useState<FaqCategory | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleCatSelect = (id: number | null) => setSelectedCatId(id)

  const { data: categories = [] } = useQuery({
    queryKey: ['faq-categories'],
    queryFn: faqApi.listCategories,
  })

  const entriesQ = useInfiniteQuery({
    queryKey: ['faq-entries', selectedCatId, search, sortBy, sortOrder],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      faqApi.listEntries({
        category_id: selectedCatId ?? undefined,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pageParam,
        size: 20,
      }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
  })

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entriesQ.hasNextPage && !entriesQ.isFetchingNextPage)
          entriesQ.fetchNextPage()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [entriesQ.hasNextPage, entriesQ.isFetchingNextPage, entriesQ.fetchNextPage])

  const deleteCatMut = useMutation({
    mutationFn: async (id: number) => {
      const children = categories.filter(c => c.parent_id === id)
      for (const child of children) {
        await faqApi.deleteCategory(child.id)
      }
      await faqApi.deleteCategory(id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-categories'] })
      qc.invalidateQueries({ queryKey: ['faq-entries'] })
      const deletedId = deleteConfirm?.id
      if (deletedId != null) {
        const childIds = categories.filter(c => c.parent_id === deletedId).map(c => c.id)
        if (selectedCatId === deletedId || childIds.includes(selectedCatId!)) setSelectedCatId(null)
      }
      toast.success('Категория удалена')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить категорию'),
  })

  const deleteEntryMut = useMutation({
    mutationFn: (id: number) => faqApi.deleteEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-entries'] })
      toast.success('Вопрос удалён')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить вопрос'),
  })

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.type === 'category') deleteCatMut.mutate(deleteConfirm.id)
    else deleteEntryMut.mutate(deleteConfirm.id)
  }

  const handleSortClick = (val: SortValue) => {
    if (sortBy === val) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(val); setSortOrder('desc') }
  }

  const allEntries = entriesQ.data?.pages.flatMap(p => p.items) ?? []
  const total = entriesQ.data?.pages[0]?.total

  const rootCats = categories.filter(c => !c.parent_id)
  const childrenOf = (parentId: number) => categories.filter(c => c.parent_id === parentId)
  const shownIds = new Set<number>()
  const orderedCats: { cat: FaqCategory; indent: number }[] = []
  for (const root of rootCats) {
    orderedCats.push({ cat: root, indent: 0 })
    shownIds.add(root.id)
    for (const child of childrenOf(root.id)) {
      orderedCats.push({ cat: child, indent: 1 })
      shownIds.add(child.id)
    }
  }
  for (const cat of categories) {
    if (!shownIds.has(cat.id)) orderedCats.push({ cat, indent: cat.parent_id ? 1 : 0 })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            {total != null && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} вопросов</p>}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">FAQ</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button onClick={() => { setView('list'); localStorage.setItem('view-mode-faq', 'list') }} title="Список" className={`p-1.5 transition-colors cursor-pointer ${view === 'list' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ListIcon className="w-4 h-4" /></button>
              <button onClick={() => { setView('grid'); localStorage.setItem('view-mode-faq', 'grid') }} title="Сетка" className={`p-1.5 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${view === 'grid' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><GridIcon className="w-4 h-4" /></button>
            </div>
            {!isReadOnly && (
              <Button onClick={() => setCreateEntryOpen(true)} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                <PlusIcon className="w-4 h-4 mr-1.5" />
                Новый вопрос
              </Button>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по вопросам и ответам"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7]"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map(opt => {
            const active = sortBy === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleSortClick(opt.value)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                  active
                    ? 'bg-[#1B3A72] text-white border-[#1B3A72]'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                )}
              >
                {opt.label}
                {active && <span className="opacity-70">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {panelWidth > 0 && (
        <div
          className={cn('shrink-0 border-r border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 flex flex-col overflow-hidden', isSnapping && 'transition-[width] duration-150')}
          style={isDesktop ? { width: panelWidth } : { width: CAT_DEFAULT }}
        >
          <div className="p-2 overflow-y-auto flex-1">
            <button
              onClick={() => handleCatSelect(null)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer mb-0.5',
                selectedCatId === null
                  ? 'bg-[#1B3A72]/10 text-[#1B3A72] dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              Все вопросы
            </button>

            {orderedCats.map(({ cat, indent }) => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                selected={selectedCatId === cat.id}
                indent={indent}
                onSelect={() => handleCatSelect(cat.id)}
                onEdit={!isReadOnly ? () => setEditCat(cat) : undefined}
                onAddChild={!isReadOnly && indent === 0 ? () => { setCreateCatParentId(cat.id); setCreateCatOpen(true) } : undefined}
                onDelete={!isReadOnly ? () => {
                  const childCount = indent === 0 ? childrenOf(cat.id).length : 0
                  setDeleteConfirm({
                    type: 'category',
                    id: cat.id,
                    name: cat.name,
                    ...(childCount > 0 ? { warning: `Также будут удалены ${childCount} подкатегор${childCount === 1 ? 'ия' : 'ии'} и все вопросы.` } : {}),
                  })
                } : undefined}
              />
            ))}
          </div>

          {!isReadOnly && (
            <div className="p-2 border-t border-slate-100 dark:border-slate-700/60">
              <button
                onClick={() => setCreateCatOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Новая категория
              </button>
            </div>
          )}
        </div>
        )}

        {panelWidth === 0 ? (
          <button
            onClick={expandPanel}
            title="Показать категории"
            className="shrink-0 w-5 flex items-center justify-center bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-700/60 text-slate-300 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRightIcon className="w-3 h-3" />
          </button>
        ) : (
          <div
            onMouseDown={handleDragStart}
            className="shrink-0 w-1 cursor-col-resize bg-slate-200 dark:bg-slate-700 hover:bg-[#4A8FE7]/60 transition-colors duration-100 group flex items-center justify-center"
            title="Потяните для изменения ширины"
          >
            <div className="flex flex-col gap-0.75 opacity-0 group-hover:opacity-100 transition-opacity">
              {[0,1,2,3,4].map(i => <div key={i} className="w-0.75 h-0.75 rounded-full bg-[#4A8FE7]" />)}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {entriesQ.isLoading && (
              <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className={`w-full rounded-xl ${view === 'grid' ? 'h-40' : 'h-28'}`} />)}
              </div>
            )}
            {!entriesQ.isLoading && allEntries.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <QuestionIcon className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Вопросов не найдено</p>
                {!isReadOnly && (
                  <button onClick={() => setCreateEntryOpen(true)} className="mt-3 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer">
                    Добавить первый вопрос
                  </button>
                )}
              </div>
            )}
            {allEntries.length > 0 && (
              <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                {allEntries.map(entry => {
                  const cat = categories.find(c => c.id === entry.category_id)
                  return (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      categoryName={cat?.name}
                      view={view}
                      onEdit={() => setEditEntry(entry)}
                      onDelete={!isReadOnly ? () => setDeleteConfirm({ type: 'entry', id: entry.id, name: entry.question }) : undefined}
                    />
                  )
                })}
              </div>
            )}

            <div ref={sentinelRef} className="h-1 mt-2" />
            {entriesQ.isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}
            {!entriesQ.hasNextPage && (total ?? 0) > 0 && (
              <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
                Все {total} вопросов загружены
              </p>
            )}
          </div>
        </div>
      </div>

      {createEntryOpen && !isReadOnly && (
        <EntryModal entry={null} categories={categories} defaultCategoryId={selectedCatId} onClose={() => setCreateEntryOpen(false)} />
      )}
      {editEntry && (
        <EntryModal entry={editEntry} categories={categories} defaultCategoryId={null} onClose={() => setEditEntry(null)} isReadOnly={isReadOnly} />
      )}
      {createCatOpen && !isReadOnly && <CategoryModal cat={null} parentId={createCatParentId} onClose={() => { setCreateCatOpen(false); setCreateCatParentId(null) }} />}
      {editCat && !isReadOnly && <CategoryModal cat={editCat} onClose={() => setEditCat(null)} />}

      {deleteConfirm && !isReadOnly && (
        <AppModal open onClose={() => setDeleteConfirm(null)}>
          <div className="px-6 py-5">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {deleteConfirm.type === 'category' ? 'Удалить категорию?' : 'Удалить вопрос?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              <strong>«{deleteConfirm.name}»</strong> будет удалена безвозвратно.
            </p>
            {deleteConfirm.warning ? (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">⚠ {deleteConfirm.warning}</p>
            ) : deleteConfirm.type === 'category' && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                ⚠ Все вопросы в этой категории также будут удалены.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="cursor-pointer">Отмена</Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleteCatMut.isPending || deleteEntryMut.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {(deleteCatMut.isPending || deleteEntryMut.isPending) ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

function CategoryRow({ cat, selected, indent, onSelect, onEdit, onDelete, onAddChild }: {
  cat: FaqCategory
  selected: boolean
  indent: number
  onSelect: () => void
  onEdit?: () => void
  onDelete?: () => void
  onAddChild?: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{ paddingLeft: `${12 + indent * 16}px` }}
      className={cn(
        'w-full flex items-center gap-1 pr-2 py-2 rounded-lg text-sm transition-colors cursor-pointer group mb-0.5',
        selected
          ? 'bg-[#1B3A72]/10 text-[#1B3A72] dark:text-blue-400 font-medium'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
      )}
    >
      {indent > 0 && <span className="text-slate-300 dark:text-slate-600 shrink-0">└</span>}
      <span className="flex-1 truncate">{cat.name}</span>
      {indent === 0 && onAddChild && (
        <button
          onClick={e => { e.stopPropagation(); onAddChild() }}
          title="Добавить подкатегорию"
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-[#1B3A72] dark:hover:text-blue-400 transition-all cursor-pointer shrink-0"
        >
          <PlusIcon className="w-3 h-3" />
        </button>
      )}
      {onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer shrink-0"
        >
          <PencilIcon className="w-3 h-3" />
        </button>
      )}
      {onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-red-500 transition-all cursor-pointer shrink-0"
        >
          <TrashIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

function EntryCard({ entry, categoryName, view = 'list', onEdit, onDelete }: {
  entry: FaqEntry
  categoryName?: string
  view?: 'list' | 'grid'
  onEdit: () => void
  onDelete?: () => void
}) {
  if (view === 'grid') {
    return (
      <div onClick={onEdit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all group cursor-pointer flex flex-col">
        <div className="flex items-start justify-between mb-2.5">
          <div className="w-9 h-9 bg-[#1B3A72] rounded-lg flex items-center justify-center shrink-0">
            <QuestionIcon className="w-4 h-4 text-white" />
          </div>
          {onDelete && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={e => { e.stopPropagation(); onDelete() }} className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{entry.question}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{entry.answer}</p>
        <div className="flex items-center gap-2 mt-auto pt-2.5 flex-wrap">
          {categoryName && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{categoryName}</span>
          )}
          <span className="text-xs text-slate-400 ml-auto">{fmtDate(entry.updated_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onEdit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all group cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-[#1B3A72] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <QuestionIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">{entry.question}</p>
            {onDelete && (
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onDelete() }} className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">{entry.answer}</p>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {categoryName && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{categoryName}</span>
            )}
            {entry.version > 1 && (
              <span className="text-xs text-slate-400">v{entry.version}</span>
            )}
            <span className="text-xs text-slate-400 ml-auto">{fmtDate(entry.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function EntryModal({ entry, categories, defaultCategoryId, onClose, isReadOnly = false }: {
  entry: FaqEntry | null
  categories: FaqCategory[]
  defaultCategoryId: number | null
  onClose: () => void
  isReadOnly?: boolean
}) {
  const qc = useQueryClient()
  const isEdit = entry !== null

  const [question, setQuestion] = useState(entry?.question ?? '')
  const [answer, setAnswer] = useState(entry?.answer ?? '')
  const [categoryId, setCategoryId] = useState<number>(
    entry?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? 0
  )

  const saveMut = useMutation({
    mutationFn: () => isEdit
      ? faqApi.updateEntry(entry.id, {
          question: question !== entry.question ? question : undefined,
          answer: answer !== entry.answer ? answer : undefined,
        })
      : faqApi.createEntry({ question, answer, category_id: categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-entries'] })
      toast.success(isEdit ? 'Вопрос обновлён' : 'Вопрос создан')
      onClose()
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const canSave = question.trim().length >= 5 && answer.trim().length >= 1 && (isEdit ? true : categoryId > 0)

  const currentCat = categories.find(c => c.id === (entry?.category_id ?? categoryId))

  return (
    <AppModal open onClose={onClose} className="sm:max-w-2xl">
      <div className="flex flex-col max-h-[85vh]">
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <QuestionIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-white leading-tight">
                {isReadOnly ? 'Просмотр вопроса' : isEdit ? 'Редактирование вопроса' : 'Новый вопрос'}
              </p>
              {isEdit && <p className="text-sm text-white/60 mt-0.5 truncate">{entry.question}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Категория {!isEdit && <span className="text-red-500">*</span>}
            </label>
            {isEdit ? (
              <div className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
                {currentCat?.name ?? '—'}
                <span className="text-xs ml-2 text-slate-400">(нельзя изменить)</span>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={e => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              >
                <option value={0} disabled>Выберите категорию</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `  └ ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Вопрос <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(мин. 5 символов)</span>
            </label>
            <input
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Введите вопрос"
              readOnly={isReadOnly}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] read-only:opacity-60 read-only:cursor-default"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">
              Ответ <span className="text-red-500">*</span>
            </label>
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Введите ответ"
              rows={8}
              readOnly={isReadOnly}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none read-only:opacity-60 read-only:cursor-default"
            />
          </div>
        </div>

        {!isReadOnly && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!canSave || saveMut.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
            >
              {saveMut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        )}
      </div>
    </AppModal>
  )
}

function CategoryModal({ cat, parentId, onClose }: { cat: FaqCategory | null; parentId?: number | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(cat?.name ?? '')
  const isEdit = cat !== null

  const saveMut = useMutation({
    mutationFn: () => isEdit
      ? faqApi.updateCategory(cat.id, { name: name || undefined })
      : faqApi.createCategory(name, parentId ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-categories'] })
      toast.success(isEdit ? 'Категория обновлена' : 'Категория создана')
      onClose()
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  return (
    <AppModal open onClose={onClose}>
      <div className="flex flex-col">
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
              <FolderIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-lg text-white">{isEdit ? 'Редактировать категорию' : parentId ? 'Новая подкатегория' : 'Новая категория'}</p>
              {isEdit && <p className="text-sm text-white/60 mt-0.5">{cat.name}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4">
          <label className="text-xs font-medium text-slate-500 block mb-1.5">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название категории"
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
          />
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || saveMut.isPending}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
          >
            {saveMut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

function QuestionIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
}
function FolderIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
}
function PencilIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
}
function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}
function ChevronLeftIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
}
function ChevronRightIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
}
function ListIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
}
function GridIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
}
