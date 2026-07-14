'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { mediaApi } from '@/lib/api/media'
import type { CabinetDocument } from '@/lib/api/media'
import { kbApi } from '@/lib/api/kb'
import type { Tag } from '@/lib/api/tags'
import { fmtSize } from './cabinet-dialog-shared'
import { FileIcon, PdfIcon, ImageIcon, TrashIcon, UploadIcon, DownloadIcon, TagIcon } from './cabinet-dialog-icons'

export function DocsTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: File; title: string; requiresApproval: boolean } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-docs', cabinetId],
    queryFn: () => mediaApi.listDocuments(cabinetId),
  })

  const tagsQ = useQuery({ queryKey: ['tags', 'document'], queryFn: () => kbApi.listTags('document') })
  const allTags = tagsQ.data ?? []

  const uploadMut = useMutation({
    mutationFn: () => mediaApi.uploadDocument(cabinetId, pending!.file, pending!.title || undefined, pending!.requiresApproval),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-docs', cabinetId] })
      toast.success('Документ загружен')
      setPending(null)
    },
    onError: () => toast.error('Ошибка при загрузке'),
  })

  const deleteMut = useMutation({
    mutationFn: (docId: number) => mediaApi.deleteDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-docs', cabinetId] })
      toast.success('Документ удалён')
      setDeleteTarget(null)
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPending({ file, title: file.name.replace(/\.[^.]+$/, ''), requiresApproval: false })
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isAdmin || pending) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    setPending({ file, title: file.name.replace(/\.[^.]+$/, ''), requiresApproval: false })
  }

  const docs = data?.items ?? []

  return (
    <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      {isAdmin && (
        <div className="px-6 py-3 border-b border-slate-50 dark:border-slate-700/30">
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
          {pending ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <FileIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{pending.file.name}</span>
                <span className="shrink-0 text-xs">{fmtSize(pending.file.size)}</span>
              </div>
              <input
                value={pending.title}
                onChange={e => setPending(p => p ? { ...p, title: e.target.value } : p)}
                placeholder="Название документа"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pending.requiresApproval}
                    onChange={e => setPending(p => p ? { ...p, requiresApproval: e.target.checked } : p)}
                    className="rounded"
                  />
                  Требует согласования
                </label>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setPending(null)} className="h-7 text-xs px-2 cursor-pointer">Отмена</Button>
                  <Button
                    onClick={() => uploadMut.mutate()}
                    disabled={uploadMut.isPending}
                    className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
                  >
                    {uploadMut.isPending ? 'Загрузка...' : 'Загрузить'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer"
            >
              <UploadIcon className="w-4 h-4" />
              Загрузить документ
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2 px-6 py-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      )}

      {!isLoading && docs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <FileIcon className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">Нет документов</p>
        </div>
      )}

      {!isLoading && docs.length > 0 && (
        <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
          {docs.map(doc => (
            <DocRow
              key={doc.id}
              doc={doc}
              allTags={allTags}
              isAdmin={isAdmin}
              onOpen={() => window.open(mediaApi.toFullUrl(doc.file_url), '_blank')}
              onDownload={() => mediaApi.downloadDocument(doc.file_url, doc.title)}
              onDelete={isAdmin ? () => setDeleteTarget({ id: doc.id, title: doc.title }) : undefined}
              deleting={deleteMut.isPending}
            />
          ))}
        </div>
      )}

      {deleteTarget && (
        <AppModal open onClose={() => setDeleteTarget(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить документ?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              <strong>«{deleteTarget.title}»</strong> будет удалён безвозвратно.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteMut.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending}
                className="bg-red-500 hover:bg-red-600 cursor-pointer"
              >
                {deleteMut.isPending ? 'Удаление...' : 'Удалить'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}
    </div>
  )
}

function DocRow({ doc, allTags, isAdmin, onOpen, onDownload, onDelete, deleting }: {
  doc: CabinetDocument
  allTags: Tag[]
  isAdmin: boolean
  onOpen: () => void
  onDownload: () => void
  onDelete?: () => void
  deleting: boolean
}) {
  const qc = useQueryClient()
  const [editingTags, setEditingTags] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Tag[]>(doc.tags)
  const [tagInput, setTagInput] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)

  const tagMut = useMutation({
    mutationFn: () => mediaApi.updateDocumentTags(doc.id, selectedTags.map(t => t.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-docs', doc.cabinet_id] })
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success('Теги обновлены')
      setEditingTags(false)
      setTagInput('')
    },
    onError: () => toast.error('Ошибка при обновлении тегов'),
  })

  const available = allTags.filter(t => !selectedTags.some(s => s.id === t.id))
  const filtered = available.filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase()))
  const exactMatch = allTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase())
  const showCreate = tagInput.trim().length > 0 && !exactMatch

  const addTag = (tag: Tag) => { setSelectedTags(p => [...p, tag]); setTagInput('') }
  const removeTag = (id: number) => setSelectedTags(p => p.filter(t => t.id !== id))

  const handleCreateTag = async () => {
    if (!tagInput.trim() || creatingTag) return
    setCreatingTag(true)
    try {
      const tag = await kbApi.createTag(tagInput.trim(), 'document')
      qc.invalidateQueries({ queryKey: ['tags'] })
      addTag(tag)
    } catch { toast.error('Не удалось создать тег') }
    finally { setCreatingTag(false) }
  }

  const cancelEdit = () => { setSelectedTags(doc.tags); setTagInput(''); setEditingTags(false) }

  return (
    <div className="group">
      <div onClick={onOpen} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          {doc.mime_type.includes('pdf') ? (
            <PdfIcon className="w-4 h-4 text-red-500" />
          ) : doc.mime_type.startsWith('image/') ? (
            <ImageIcon className="w-4 h-4 text-blue-500" />
          ) : (
            <FileIcon className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{doc.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {doc.doc_type && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                {doc.doc_type}
              </span>
            )}
            <span className="text-xs text-slate-400">{fmtSize(doc.file_size_bytes)}</span>
            {doc.requires_approval && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                Согласование
              </span>
            )}
            {doc.tags.map(tag => (
              <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                {tag.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAdmin && (
            <button
              onClick={e => { e.stopPropagation(); setEditingTags(v => !v) }}
              title="Теги"
              className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer"
            >
              <TagIcon className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDownload() }}
            title="Скачать"
            className="w-7 h-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <DownloadIcon className="w-4 h-4" />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              disabled={deleting}
              title="Удалить"
              className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {editingTags && (
        <div onClick={e => e.stopPropagation()} className="px-6 pb-3 space-y-2 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/30">
          <div className="flex flex-wrap gap-1.5 pt-2">
            {selectedTags.length === 0 && (
              <span className="text-xs text-slate-400 italic">Нет тегов</span>
            )}
            {selectedTags.map(tag => (
              <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1B3A72]/10 text-[#1B3A72] dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                {tag.name}
                <button onClick={() => removeTag(tag.id)} className="hover:text-red-500 transition-colors cursor-pointer leading-none">×</button>
              </span>
            ))}
          </div>

          <div className="relative">
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); showCreate ? handleCreateTag() : filtered[0] && addTag(filtered[0]) } }}
              placeholder="Найти или создать тег..."
              className="w-full px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
            />
            {tagInput && (filtered.length > 0 || showCreate) && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden max-h-36 overflow-y-auto">
                {filtered.map(tag => (
                  <button key={tag.id} onMouseDown={() => addTag(tag)} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                    {tag.name}
                  </button>
                ))}
                {showCreate && (
                  <button onMouseDown={handleCreateTag} disabled={creatingTag} className="w-full text-left px-3 py-1.5 text-xs text-[#1B3A72] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 cursor-pointer flex gap-1">
                    <span className="font-medium">+ Создать</span> «{tagInput.trim()}»
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancelEdit} className="h-6 text-xs px-2 cursor-pointer">Отмена</Button>
            <Button onClick={() => tagMut.mutate()} disabled={tagMut.isPending} className="h-6 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
              {tagMut.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
