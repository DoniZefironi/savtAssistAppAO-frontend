'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { faqApi } from '@/lib/api/faq'
import type { FaqCategory, FaqEntry } from '@/lib/api/faq'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function FaqView() {
  const qc = useQueryClient()
  const [catCollapsed, setCatCollapsed] = useState(false)
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editEntry, setEditEntry] = useState<FaqEntry | null>(null)
  const [createEntryOpen, setCreateEntryOpen] = useState(false)
  const [createCatOpen, setCreateCatOpen] = useState(false)
  const [editCat, setEditCat] = useState<FaqCategory | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleCatSelect = (id: number | null) => { setSelectedCatId(id); setPage(1) }

  const categoriesQ = useQuery({ queryKey: ['faq-categories'], queryFn: faqApi.listCategories })
  const entriesQ = useQuery({
    queryKey: ['faq-entries', selectedCatId, search, page],
    queryFn: () => faqApi.listEntries({ category_id: selectedCatId ?? undefined, search: search || undefined, page, size: 20 }),
  })

  const deleteCatMut = useMutation({
    mutationFn: (id: number) => faqApi.deleteCategory(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-categories'] }); toast.success('Категория удалена') },
    onError: () => toast.error('Не удалось удалить категорию'),
  })

  const deleteEntryMut = useMutation({
    mutationFn: (id: number) => faqApi.deleteEntry(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['faq-entries'] }); toast.success('Вопрос удалён') },
    onError: () => toast.error('Не удалось удалить вопрос'),
  })

  const categories = categoriesQ.data ?? []
  const entries = entriesQ.data?.items ?? []
  const total = entriesQ.data?.total

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            {total != null && <p className="text-xs text-slate-400 font-medium mb-0.5">{total} вопросов</p>}
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">FAQ</h1>
          </div>
          <Button
            onClick={() => setCreateEntryOpen(true)}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            Новый вопрос
          </Button>
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Поиск по вопросам и ответам"
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7]"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category panel */}
        <div className={cn(
          'shrink-0 border-r border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 flex flex-col overflow-hidden transition-[width] duration-200',
          catCollapsed ? 'w-0 border-r-0' : 'w-52'
        )}>
          <div className="p-3 space-y-0.5">
            <button
              onClick={() => handleCatSelect(null)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer',
                selectedCatId === null
                  ? 'bg-[#1B3A72]/10 text-[#1B3A72] dark:text-blue-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              Все вопросы
            </button>
            {categories.map(cat => (
              <CategoryRow
                key={cat.id}
                cat={cat}
                selected={selectedCatId === cat.id}
                onSelect={() => handleCatSelect(cat.id)}
                onEdit={() => setEditCat(cat)}
                onDelete={() => deleteCatMut.mutate(cat.id)}
              />
            ))}
          </div>
          <div className="p-3 mt-auto border-t border-slate-100 dark:border-slate-700/60">
            <button
              onClick={() => setCreateCatOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Новая категория
            </button>
          </div>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setCatCollapsed(v => !v)}
          title={catCollapsed ? 'Показать категории' : 'Скрыть категории'}
          className="shrink-0 w-5 flex items-center justify-center bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-700/60 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {catCollapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronLeftIcon className="w-3 h-3" />}
        </button>

        {/* Entries list */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {entriesQ.isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
              </div>
            )}
            {!entriesQ.isLoading && entries.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <QuestionIcon className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Вопросов не найдено</p>
                <button
                  onClick={() => setCreateEntryOpen(true)}
                  className="mt-3 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Добавить первый вопрос
                </button>
              </div>
            )}
            {!entriesQ.isLoading && entries.length > 0 && (
              <div className="space-y-3">
                {entries.map(entry => {
                  const cat = categories.find(c => c.id === entry.category_id)
                  return (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      categoryName={cat?.name}
                      onEdit={() => setEditEntry(entry)}
                      onDelete={() => deleteEntryMut.mutate(entry.id)}
                    />
                  )
                })}
              </div>
            )}
          </div>
          {entriesQ.data && entriesQ.data.pages > 1 && (
            <Pagination page={page} pages={entriesQ.data.pages} onPage={setPage} />
          )}
        </div>
      </div>

      {/* Modals */}
      {createEntryOpen && (
        <EntryModal
          entry={null}
          categories={categories}
          defaultCategoryId={selectedCatId}
          onClose={() => setCreateEntryOpen(false)}
        />
      )}
      {editEntry && (
        <EntryModal
          entry={editEntry}
          categories={categories}
          defaultCategoryId={null}
          onClose={() => setEditEntry(null)}
        />
      )}
      {createCatOpen && (
        <CategoryModal cat={null} onClose={() => setCreateCatOpen(false)} />
      )}
      {editCat && (
        <CategoryModal cat={editCat} onClose={() => setEditCat(null)} />
      )}
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, selected, onSelect, onEdit, onDelete }: {
  cat: FaqCategory
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer group',
        selected
          ? 'bg-[#1B3A72]/10 text-[#1B3A72] dark:text-blue-400 font-medium'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
      )}
    >
      <span className="flex-1 truncate">{cat.name}</span>
      <button
        onClick={e => { e.stopPropagation(); onEdit() }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
      >
        <PencilIcon className="w-3 h-3" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:text-red-500 transition-all cursor-pointer"
      >
        <TrashIcon className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, categoryName, onEdit, onDelete }: {
  entry: FaqEntry
  categoryName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onEdit}
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-5 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all group cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-[#1B3A72] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
          <QuestionIcon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">{entry.question}</p>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); onEdit() }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <PencilIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {entry.answer}
          </p>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {categoryName && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                {categoryName}
              </span>
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

// ─── Entry modal ──────────────────────────────────────────────────────────────

function EntryModal({ entry, categories, defaultCategoryId, onClose }: {
  entry: FaqEntry | null
  categories: FaqCategory[]
  defaultCategoryId: number | null
  onClose: () => void
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
      ? faqApi.updateEntry(entry.id, { question: question || undefined, answer: answer || undefined })
      : faqApi.createEntry({ question, answer, category_id: categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['faq-entries'] })
      toast.success(isEdit ? 'Вопрос обновлён' : 'Вопрос создан')
      onClose()
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const canSave = question.trim().length >= 5 && answer.trim().length >= 1 && categoryId > 0

  return (
    <AppModal open onClose={onClose} className="sm:max-w-2xl">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <QuestionIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-white leading-tight">
                {isEdit ? 'Редактирование вопроса' : 'Новый вопрос'}
              </p>
              {isEdit && (
                <p className="text-sm text-white/60 mt-0.5 truncate">{entry.question}</p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
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
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!canSave || saveMut.isPending}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
          >
            {saveMut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

// ─── Category modal ───────────────────────────────────────────────────────────

function CategoryModal({ cat, onClose }: { cat: FaqCategory | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(cat?.name ?? '')
  const isEdit = cat !== null

  const saveMut = useMutation({
    mutationFn: () => isEdit
      ? faqApi.updateCategory(cat.id, { name: name || undefined })
      : faqApi.createCategory(name),
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
              <p className="font-bold text-lg text-white">{isEdit ? 'Редактировать категорию' : 'Новая категория'}</p>
              {isEdit && <p className="text-sm text-white/60 mt-0.5">{cat.name}</p>}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
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
        </div>
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || saveMut.isPending}
            className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
          >
            {saveMut.isPending ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </AppModal>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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
