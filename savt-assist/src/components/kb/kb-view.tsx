'use client'

import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { kbApi } from '@/lib/api/kb'
import type { KbArticleDetail, KbArticleList, KbAttachment, KbCategory, Tag } from '@/lib/api/kb'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { API_URL } from '@/lib/api/client'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function fullUrl(url: string) {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_URL}${url}`
}

type SortValue = 'created_at' | 'updated_at' | 'title'

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'created_at', label: 'По дате' },
  { value: 'updated_at', label: 'По изменению' },
  { value: 'title', label: 'По названию' },
]

interface DeleteConfirm {
  type: 'category' | 'article'
  id: number
  name: string
  warning?: string
}

const CAT_DEFAULT = 208
const CAT_MAX = 360
const CAT_SNAP = 56  // below this → snap to 0 (hidden)

export function KbView() {
  const qc = useQueryClient()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Panel resize
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
    const saved = localStorage.getItem('view-mode-kb')
    if (saved === 'list' || saved === 'grid') setView(saved)
  }, [])
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortValue>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [editArticle, setEditArticle] = useState<KbArticleList | null>(null)
  const [createArticleOpen, setCreateArticleOpen] = useState(false)
  const [createCatOpen, setCreateCatOpen] = useState(false)
  const [editCat, setEditCat] = useState<KbCategory | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleCatSelect = (id: number | null) => setSelectedCatId(id)

  const categoriesQ = useQuery({ queryKey: ['kb-categories'], queryFn: kbApi.listCategories })
  const tagsQ = useQuery({ queryKey: ['kb-tags', 'document'], queryFn: () => kbApi.listTags('document') })

  const articlesQ = useInfiniteQuery({
    queryKey: ['kb-articles', selectedCatId, search, sortBy, sortOrder, selectedTagIds],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      kbApi.listArticles({
        category_id: selectedCatId ?? undefined,
        search: search || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        page: pageParam,
        size: 20,
      }),
    getNextPageParam: p => p.page < p.pages ? p.page + 1 : undefined,
  })

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && articlesQ.hasNextPage && !articlesQ.isFetchingNextPage)
          articlesQ.fetchNextPage()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [articlesQ.hasNextPage, articlesQ.isFetchingNextPage, articlesQ.fetchNextPage])

  const deleteCatMut = useMutation({
    mutationFn: (id: number) => kbApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-categories'] })
      qc.invalidateQueries({ queryKey: ['kb-articles'] })
      if (selectedCatId === deleteConfirm?.id) setSelectedCatId(null)
      toast.success('Категория удалена')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить категорию'),
  })

  const deleteArticleMut = useMutation({
    mutationFn: (id: number) => kbApi.deleteArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-articles'] })
      toast.success('Статья удалена')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Не удалось удалить статью'),
  })

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return
    if (deleteConfirm.type === 'category') deleteCatMut.mutate(deleteConfirm.id)
    else deleteArticleMut.mutate(deleteConfirm.id)
  }

  const handleSortClick = (val: SortValue) => {
    if (sortBy === val) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(val); setSortOrder('desc') }
  }

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const categories = categoriesQ.data ?? []
  const docTags = tagsQ.data ?? []
  const allArticles = articlesQ.data?.pages.flatMap(p => p.items) ?? []
  const total = articlesQ.data?.pages[0]?.total

  // Build category tree (2 levels)
  const rootCats = categories.filter(c => !c.parent_id)
  const childrenOf = (parentId: number) => categories.filter(c => c.parent_id === parentId)

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            {total != null && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} статей</p>}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">База знаний</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button onClick={() => { setView('list'); localStorage.setItem('view-mode-kb', 'list') }} title="Список" className={`p-1.5 transition-colors cursor-pointer ${view === 'list' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><ListIcon className="w-4 h-4" /></button>
              <button onClick={() => { setView('grid'); localStorage.setItem('view-mode-kb', 'grid') }} title="Сетка" className={`p-1.5 transition-colors cursor-pointer border-l border-slate-200 dark:border-slate-700 ${view === 'grid' ? 'bg-[#1B3A72] text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><GridIcon className="w-4 h-4" /></button>
            </div>
            <Button onClick={() => setCreateArticleOpen(true)} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
              <PlusIcon className="w-4 h-4 mr-1.5" />
              Новая статья
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по статьям"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7]"
          />
        </div>

        {/* Sort + tag filters */}
        <div className="flex flex-wrap gap-2 items-center">
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

          {docTags.length > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
              {docTags.map(tag => {
                const active = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer',
                      active
                        ? 'bg-[#4A8FE7] text-white border-[#4A8FE7]'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    )}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category panel */}
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
              Все статьи
            </button>

            {rootCats.map(root => {
              const children = childrenOf(root.id)
              return (
                <div key={root.id}>
                  <CategoryRow
                    cat={root}
                    selected={selectedCatId === root.id}
                    indent={0}
                    onSelect={() => handleCatSelect(root.id)}
                    onEdit={() => setEditCat(root)}
                    onDelete={() => setDeleteConfirm({
                      type: 'category',
                      id: root.id,
                      name: root.name,
                      warning: 'Все статьи и вложения в этой категории будут удалены безвозвратно.',
                    })}
                  />
                  {children.map(child => (
                    <CategoryRow
                      key={child.id}
                      cat={child}
                      selected={selectedCatId === child.id}
                      indent={1}
                      onSelect={() => handleCatSelect(child.id)}
                      onEdit={() => setEditCat(child)}
                      onDelete={() => setDeleteConfirm({
                        type: 'category',
                        id: child.id,
                        name: child.name,
                        warning: 'Все статьи и вложения в этой категории будут удалены безвозвратно.',
                      })}
                    />
                  ))}
                </div>
              )
            })}
          </div>

          <div className="p-2 border-t border-slate-100 dark:border-slate-700/60">
            <button
              onClick={() => setCreateCatOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Новая категория
            </button>
          </div>
        </div>
        )}

        {/* Drag handle / expand strip */}
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
            <div className="flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
              {[0,1,2,3,4].map(i => <div key={i} className="w-[3px] h-[3px] rounded-full bg-[#4A8FE7]" />)}
            </div>
          </div>
        )}

        {/* Articles */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {articlesQ.isLoading && (
              <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className={`w-full rounded-xl ${view === 'grid' ? 'h-40' : 'h-28'}`} />)}
              </div>
            )}
            {!articlesQ.isLoading && allArticles.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <BookIcon className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Статей не найдено</p>
                <button onClick={() => setCreateArticleOpen(true)} className="mt-3 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer">
                  Создать первую статью
                </button>
              </div>
            )}
            {allArticles.length > 0 && (
              <div className={view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}>
                {allArticles.map(article => {
                  const cat = categories.find(c => c.id === article.category_id)
                  return (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      categoryName={cat?.name}
                      view={view}
                      onEdit={() => setEditArticle(article)}
                      onDelete={() => setDeleteConfirm({ type: 'article', id: article.id, name: article.title })}
                    />
                  )
                })}
              </div>
            )}

            <div ref={sentinelRef} className="h-1 mt-2" />
            {articlesQ.isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <svg className="w-5 h-5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            )}
            {!articlesQ.hasNextPage && (total ?? 0) > 0 && (
              <p className="text-center text-xs text-slate-300 dark:text-slate-600 py-4">
                Все {total} статей загружены
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {createArticleOpen && (
        <ArticleModal article={null} categories={categories} defaultCategoryId={selectedCatId} onClose={() => setCreateArticleOpen(false)} />
      )}
      {editArticle && (
        <ArticleModal article={editArticle} categories={categories} defaultCategoryId={null} onClose={() => setEditArticle(null)} />
      )}
      {createCatOpen && <CategoryModal cat={null} onClose={() => setCreateCatOpen(false)} />}
      {editCat && <CategoryModal cat={editCat} onClose={() => setEditCat(null)} />}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <AppModal open onClose={() => setDeleteConfirm(null)}>
          <div className="px-6 py-5">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {deleteConfirm.type === 'category' ? 'Удалить категорию?' : 'Удалить статью?'}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              <strong>«{deleteConfirm.name}»</strong> будет удалена безвозвратно.
            </p>
            {deleteConfirm.warning && (
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                ⚠ {deleteConfirm.warning}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={deleteCatMut.isPending || deleteArticleMut.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {(deleteCatMut.isPending || deleteArticleMut.isPending) ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, selected, indent, onSelect, onEdit, onDelete }: {
  cat: KbCategory
  selected: boolean
  indent: number
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
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
      <button
        onClick={e => { e.stopPropagation(); onEdit() }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer shrink-0"
      >
        <PencilIcon className="w-3 h-3" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-red-500 transition-all cursor-pointer shrink-0"
      >
        <TrashIcon className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article, categoryName, view = 'list', onEdit, onDelete }: {
  article: KbArticleList
  categoryName?: string
  view?: 'list' | 'grid'
  onEdit: () => void
  onDelete: () => void
}) {
  if (view === 'grid') {
    return (
      <div onClick={onEdit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all group cursor-pointer flex flex-col">
        <div className="flex items-start justify-between mb-2.5">
          <div className="w-9 h-9 bg-[#1B3A72] rounded-lg flex items-center justify-center shrink-0">
            <BookIcon className="w-4 h-4 text-white" />
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={e => { e.stopPropagation(); onEdit() }} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{article.title}</p>
        {article.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{article.description}</p>
        )}
        <div className="flex flex-wrap gap-1 mt-auto pt-2.5">
          {categoryName && (
            <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{categoryName}</span>
          )}
          {article.tags.slice(0, 2).map(tag => (
            <span key={tag.id} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{tag.name}</span>
          ))}
          <span className="text-xs text-slate-400 ml-auto">{fmtDate(article.created_at)}</span>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onEdit} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all group cursor-pointer">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-[#1B3A72] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <BookIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">{article.title}</p>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={e => { e.stopPropagation(); onEdit() }} className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer">
                <PencilIcon className="w-3.5 h-3.5" />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete() }} className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {article.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">{article.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {categoryName && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">{categoryName}</span>
            )}
            {article.tags.map(tag => (
              <span key={tag.id} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">{tag.name}</span>
            ))}
            {article.attachment_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <PaperclipIcon className="w-3 h-3" />
                {article.attachment_count}
              </span>
            )}
            <span className="text-xs text-slate-400 ml-auto">{fmtDate(article.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Article modal ────────────────────────────────────────────────────────────

function ArticleModal({ article, categories, defaultCategoryId, onClose }: {
  article: KbArticleList | null
  categories: KbCategory[]
  defaultCategoryId: number | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = article !== null

  const detailQ = useQuery({
    queryKey: ['kb-article', article?.id],
    queryFn: () => kbApi.getArticle(article!.id),
    enabled: isEdit,
  })
  const detail = detailQ.data

  const tagsQ = useQuery({ queryKey: ['kb-tags', 'document'], queryFn: () => kbApi.listTags('document') })
  const allTags = tagsQ.data ?? []

  const [title, setTitle] = useState(article?.title ?? '')
  const [description, setDescription] = useState(article?.description ?? '')
  const [categoryId, setCategoryId] = useState<number>(
    article?.category_id ?? defaultCategoryId ?? categories[0]?.id ?? 0
  )
  const [selectedTags, setSelectedTags] = useState<Tag[]>(article?.tags ?? [])
  const [tab, setTab] = useState<'content' | 'attachments'>('content')

  useEffect(() => {
    if (detail) {
      setTitle(detail.title)
      setDescription(detail.description ?? '')
      setCategoryId(detail.category_id)
      setSelectedTags(detail.tags)
    }
  }, [detail])

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['kb-articles'] })
    qc.invalidateQueries({ queryKey: ['kb-tags'] })
    if (isEdit) qc.invalidateQueries({ queryKey: ['kb-article', article.id] })
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const saved = isEdit
        ? await kbApi.updateArticle(article.id, { title: title || null, description: description || null, category_id: categoryId })
        : await kbApi.createArticle({ title, description: description || null, category_id: categoryId })
      await kbApi.updateArticleTags(saved.id, selectedTags.map(t => t.id))
      return saved
    },
    onSuccess: () => { invalidate(); toast.success(isEdit ? 'Статья обновлена' : 'Статья создана'); onClose() },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const handleCreateTag = async (name: string): Promise<Tag> => {
    const tag = await kbApi.createTag(name, 'document')
    qc.invalidateQueries({ queryKey: ['kb-tags'] })
    return tag
  }

  const canSave = title.trim().length > 0 && categoryId > 0

  const TABS = isEdit
    ? [
        { id: 'content', label: 'Контент' },
        { id: 'attachments', label: `Вложения${detail ? ` (${detail.attachments.length})` : ''}` },
      ]
    : [{ id: 'content', label: 'Контент' }]

  return (
    <AppModal open onClose={onClose} className="sm:max-w-2xl">
      <div className="flex flex-col max-h-[85vh]">
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <BookIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-white leading-tight">
                {isEdit ? 'Редактирование статьи' : 'Новая статья'}
              </p>
              {isEdit && <p className="text-sm text-white/60 mt-0.5 truncate">{article.title}</p>}
            </div>
          </div>
        </div>

        {isEdit && (
          <div className="flex border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 shrink-0">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as 'content' | 'attachments')}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
                  tab === t.id
                    ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {tab === 'content' && (
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">
                  Категория <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                >
                  <option value={0} disabled>Выберите категорию</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.parent_id ? `  └ ${c.name}` : c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">
                  Заголовок <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Введите заголовок статьи"
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Описание</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Текст статьи"
                  rows={8}
                  maxLength={5000}
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{description.length}/5000</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1.5">Теги</label>
                <TagSelector
                  selected={selectedTags}
                  allTags={allTags}
                  onChange={setSelectedTags}
                  onCreateTag={handleCreateTag}
                />
              </div>
            </div>
          )}
          {tab === 'attachments' && detail && <AttachmentsTab article={detail} />}
          {tab === 'attachments' && !detail && (
            <div className="p-6 space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
            </div>
          )}
        </div>

        {tab === 'content' && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
              {saveMut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        )}
      </div>
    </AppModal>
  )
}

// ─── Attachments tab ──────────────────────────────────────────────────────────

function AttachmentsTab({ article }: { article: KbArticleDetail }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadMut = useMutation({
    mutationFn: (file: File) => kbApi.uploadAttachment(article.id, file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-article', article.id] }); toast.success('Файл добавлен') },
    onError: () => toast.error('Ошибка загрузки'),
  })

  const deleteMut = useMutation({
    mutationFn: (attId: number) => kbApi.deleteAttachment(article.id, attId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-article', article.id] })
      qc.invalidateQueries({ queryKey: ['kb-articles'] })
      toast.success('Файл удалён')
    },
    onError: () => toast.error('Ошибка удаления'),
  })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMut.mutate(file)
    e.target.value = ''
  }

  return (
    <div>
      <div className="px-6 py-3 border-b border-slate-50 dark:border-slate-700/30">
        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploadMut.isPending}
          className="flex items-center gap-2 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline disabled:opacity-50 cursor-pointer"
        >
          <UploadIcon className="w-4 h-4" />
          {uploadMut.isPending ? 'Загрузка...' : 'Добавить вложение'}
        </button>
      </div>

      {article.attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <PaperclipIcon className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">Нет вложений</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
          {article.attachments.map(att => (
            <AttachmentRow
              key={att.id}
              att={att}
              articleId={article.id}
              onDelete={() => deleteMut.mutate(att.id)}
              deleting={deleteMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AttachmentRow({ att, articleId, onDelete, deleting }: {
  att: KbAttachment
  articleId: number
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div
      onClick={() => window.open(fullUrl(att.file_url), '_blank')}
      className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 group cursor-pointer"
    >
      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
        {att.mime_type.includes('pdf')
          ? <PdfIcon className="w-4 h-4 text-red-500" />
          : att.mime_type.startsWith('image/')
          ? <ImageIcon className="w-4 h-4 text-blue-500" />
          : <FileIcon className="w-4 h-4 text-slate-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{att.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-400">{fmtSize(att.file_size_bytes)}</span>
          {att.doc_type && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
              {att.doc_type}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); kbApi.downloadAttachment(articleId, att.id, att.title) }}
          title="Скачать"
          className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <DownloadIcon className="w-4 h-4" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          disabled={deleting}
          title="Удалить"
          className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Category modal ───────────────────────────────────────────────────────────

function CategoryModal({ cat, onClose }: { cat: KbCategory | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(cat?.name ?? '')
  const [description, setDescription] = useState(cat?.description ?? '')
  const isEdit = cat !== null

  const saveMut = useMutation({
    mutationFn: () => isEdit
      ? kbApi.updateCategory(cat.id, { name: name || undefined, description: description || null })
      : kbApi.createCategory(name, null, description || null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb-categories'] })
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
              <p className="font-bold text-lg text-white">{isEdit ? 'Редактировать категорию' : 'Новая категория'}</p>
              {isEdit && <p className="text-sm text-white/60 mt-0.5">{cat.name}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Название <span className="text-red-500">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Название категории"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Необязательно"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button onClick={() => saveMut.mutate()} disabled={!name.trim() || saveMut.isPending} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
            {saveMut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

// ─── Tag selector ─────────────────────────────────────────────────────────────

function TagSelector({ selected, allTags, onChange, onCreateTag }: {
  selected: Tag[]
  allTags: Tag[]
  onChange: (tags: Tag[]) => void
  onCreateTag: (name: string) => Promise<Tag>
}) {
  const [input, setInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState(false)

  const available = allTags.filter(t => !selected.some(s => s.id === t.id))
  const filtered = available.filter(t => t.name.toLowerCase().includes(input.toLowerCase()))
  const exactMatch = allTags.some(t => t.name.toLowerCase() === input.trim().toLowerCase())
  const showCreate = input.trim().length > 0 && !exactMatch

  const addTag = (tag: Tag) => { onChange([...selected, tag]); setInput(''); setOpen(false) }
  const removeTag = (id: number) => onChange(selected.filter(t => t.id !== id))

  const handleCreate = async () => {
    if (!input.trim() || creating) return
    setCreating(true)
    try {
      const tag = await onCreateTag(input.trim())
      addTag(tag)
    } catch {
      toast.error('Не удалось создать тег')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(tag => (
            <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1B3A72]/10 text-[#1B3A72] dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
              {tag.name}
              <button onClick={() => removeTag(tag.id)} className="hover:text-red-500 transition-colors cursor-pointer leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); showCreate ? handleCreate() : filtered[0] && addTag(filtered[0]) } }}
          placeholder="Найти или создать тег..."
          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
        />
        {open && (filtered.length > 0 || showCreate) && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto">
            {filtered.map(tag => (
              <button key={tag.id} onMouseDown={() => addTag(tag)} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                {tag.name}
              </button>
            ))}
            {showCreate && (
              <button onMouseDown={handleCreate} disabled={creating} className="w-full text-left px-3 py-2 text-sm text-[#1B3A72] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 border-t border-slate-100 dark:border-slate-700">
                <span className="font-medium">+ Создать</span>
                <span>«{input.trim()}»</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BookIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
}
function FolderIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
}
function PaperclipIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
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
function FileIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
}
function PdfIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
}
function ImageIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
}
function UploadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
}
function DownloadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
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
