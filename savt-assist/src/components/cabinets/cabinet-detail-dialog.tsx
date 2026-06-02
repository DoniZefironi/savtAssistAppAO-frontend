'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WarrantyBadge } from './warranty-badge'
import { cabinetsApi, UpdateCabinetDto } from '@/lib/api/cabinets'
import type { CabinetUser } from '@/lib/api/cabinets'
import { mediaApi } from '@/lib/api/media'
import type { CabinetDocument, CabinetPhoto } from '@/lib/api/media'
import { kbApi } from '@/lib/api/kb'
import type { Tag } from '@/lib/api/kb'
import { formatDate } from '@/lib/warranty'
import { cn } from '@/lib/utils'
import type { Cabinet } from '@/types'

type Tab = 'info' | 'docs' | 'photos' | 'users'

interface Props {
  cabinetId: number | null
  isAdmin: boolean
  initialMode?: 'view' | 'edit'
  onClose: () => void
}

export function CabinetDetailDialog({ cabinetId, isAdmin, initialMode = 'view', onClose }: Props) {
  return (
    <AppModal open={cabinetId !== null} onClose={onClose}>
      {cabinetId !== null && (
        <DetailContent
          cabinetId={cabinetId}
          isAdmin={isAdmin}
          initialMode={initialMode}
        />
      )}
    </AppModal>
  )
}

function DetailContent({ cabinetId, isAdmin, initialMode }: {
  cabinetId: number
  isAdmin: boolean
  initialMode: 'view' | 'edit'
}) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('info')
  const [editing, setEditing] = useState(initialMode === 'edit')
  const [fields, setFields] = useState<FormFields | null>(null)

  const { data: cabinet, isLoading } = useQuery({
    queryKey: ['cabinet', cabinetId],
    queryFn: () => cabinetsApi.getOne(cabinetId),
  })

  useEffect(() => {
    if (cabinet) setFields(cabinetToFields(cabinet))
    setEditing(initialMode === 'edit')
  }, [cabinet, initialMode])

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCabinetDto) => cabinetsApi.update(cabinetId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      qc.invalidateQueries({ queryKey: ['cabinet', cabinetId] })
      toast.success('Изменения сохранены')
      setEditing(false)
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const handleSave = () => {
    if (!fields) return
    updateMutation.mutate(fieldsToDto(fields))
  }

  const handleCancel = () => {
    if (cabinet) setFields(cabinetToFields(cabinet))
    setEditing(false)
  }

  const handleTabChange = (t: Tab) => {
    if (editing) handleCancel()
    setTab(t)
  }

  if (isLoading || !fields || !cabinet) {
    return <DetailSkeleton />
  }

  const set = (key: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((p) => p ? { ...p, [key]: e.target.value } : p)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Информация' },
    { id: 'docs', label: 'Документы' },
    { id: 'photos', label: 'Фото' },
    { id: 'users', label: 'Пользователи' },
  ]

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Header */}
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
        <div className="flex items-start gap-4 pr-2">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
            <BoardIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <>
                <input
                  value={fields.admin_internal_name}
                  onChange={set('admin_internal_name')}
                  placeholder="Внутреннее название"
                  className="w-full font-bold text-lg text-white bg-transparent border-b border-white/30 focus:border-white outline-none placeholder:text-white/30 pb-0.5 leading-tight"
                />
                <input
                  value={fields.object_number}
                  onChange={set('object_number')}
                  placeholder="Номер объекта"
                  className="w-full text-sm text-white/60 bg-transparent border-b border-white/20 focus:border-white/50 outline-none placeholder:text-white/20 mt-1.5"
                />
              </>
            ) : (
              <>
                <p className="font-bold text-lg text-white leading-tight truncate">
                  {fields.admin_internal_name || fields.object_number}
                </p>
                <p className="text-sm text-white/60 mt-0.5">{fields.object_number}</p>
              </>
            )}
            <div className="mt-2">
              <WarrantyBadge warrantyEndsAt={fields.warranty_end ? new Date(fields.warranty_end).toISOString() : null} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'info' && (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
            <DetailRow label="Тип" value={fields.type} editing={editing} onChange={set('type')} placeholder="Добавить тип" />
            <DetailRow label="Описание" value={fields.description} editing={editing} onChange={set('description')} placeholder="Добавить описание" multiline />
            <DetailRow label="Назначение" value={fields.purpose} editing={editing} onChange={set('purpose')} placeholder="Добавить назначение" />
            <DetailRow label="Комментарий" value={fields.admin_comment} editing={editing} onChange={set('admin_comment')} placeholder="Добавить комментарий" multiline />
            <DateRow label="Гарантия с" value={fields.warranty_start} editing={editing} onChange={(v) => setFields((p) => p ? { ...p, warranty_start: v } : p)} />
            <DateRow label="Гарантия до" value={fields.warranty_end} editing={editing} onChange={(v) => setFields((p) => p ? { ...p, warranty_end: v } : p)} />
          </div>
        )}
        {tab === 'docs' && <DocsTab cabinetId={cabinetId} isAdmin={isAdmin} />}
        {tab === 'photos' && <PhotosTab cabinetId={cabinetId} isAdmin={isAdmin} />}
        {tab === 'users' && <UsersTab cabinetId={cabinetId} isAdmin={isAdmin} />}
      </div>

      {/* Footer — only for info tab */}
      {tab === 'info' && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          {!editing && isAdmin && (
            <button
              onClick={() => setEditing(true)}
              title="Редактировать"
              className="w-8 h-8 rounded-lg bg-blue/15 hover:bg-blue/25 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <PencilIcon className="w-4 h-4 text-blue" />
            </button>
          )}
          {editing && (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
              >
                {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Documents tab ───────────────────────────────────────────────────────────

function DocsTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: File; title: string; requiresApproval: boolean } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-docs', cabinetId],
    queryFn: () => mediaApi.listDocuments(cabinetId),
  })

  const tagsQ = useQuery({ queryKey: ['tags'], queryFn: kbApi.listTags })
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
              onDelete={isAdmin ? () => deleteMut.mutate(doc.id) : undefined}
              deleting={deleteMut.isPending}
            />
          ))}
        </div>
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
      const tag = await kbApi.createTag(tagInput.trim())
      qc.invalidateQueries({ queryKey: ['tags'] })
      addTag(tag)
    } catch { toast.error('Не удалось создать тег') }
    finally { setCreatingTag(false) }
  }

  const cancelEdit = () => { setSelectedTags(doc.tags); setTagInput(''); setEditingTags(false) }

  return (
    <div className="group">
      {/* Main row */}
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

      {/* Inline tag editor */}
      {editingTags && (
        <div onClick={e => e.stopPropagation()} className="px-6 pb-3 space-y-2 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/30">
          {/* Selected tags */}
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

          {/* Search input + dropdown */}
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

          {/* Save / Cancel */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancelEdit} className="h-6 text-xs px-2 cursor-pointer">Отмена</Button>
            <Button onClick={() => tagMut.mutate()} disabled={tagMut.isPending} className="h-6 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
              {tagMut.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Photos tab ──────────────────────────────────────────────────────────────

function PhotosTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-photos', cabinetId],
    queryFn: () => mediaApi.listPhotos(cabinetId),
  })

  const uploadMut = useMutation({
    mutationFn: () => mediaApi.uploadPhoto(cabinetId, pendingFile!, caption || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-photos', cabinetId] })
      toast.success('Фото добавлено')
      setPendingFile(null)
      setCaption('')
    },
    onError: () => toast.error('Ошибка при загрузке'),
  })

  const deleteMut = useMutation({
    mutationFn: (photoId: number) => mediaApi.deletePhoto(photoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-photos', cabinetId] })
      toast.success('Фото удалено')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setCaption('')
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (!isAdmin || pendingFile) return
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPendingFile(file)
    setCaption('')
  }

  const cancelPending = () => { setPendingFile(null); setCaption('') }

  const photos = data?.items ?? []

  return (
    <div onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      {isAdmin && (
        <div className="px-6 py-3 border-b border-slate-50 dark:border-slate-700/30">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {pendingFile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{pendingFile.name}</span>
                <span className="shrink-0 text-xs">{fmtSize(pendingFile.size)}</span>
              </div>
              <input
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Подпись (необязательно)"
                className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7]"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={cancelPending} className="h-7 text-xs px-2 cursor-pointer">Отмена</Button>
                <Button
                  onClick={() => uploadMut.mutate()}
                  disabled={uploadMut.isPending}
                  className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
                >
                  {uploadMut.isPending ? 'Загрузка...' : 'Добавить'}
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer"
            >
              <UploadIcon className="w-4 h-4" />
              Добавить фото
            </button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-2 px-6 py-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      )}

      {!isLoading && photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <ImageIcon className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm">Нет фотографий</p>
        </div>
      )}

      {!isLoading && photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 px-6 py-4">
          {photos.map(photo => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              onDelete={isAdmin ? () => deleteMut.mutate(photo.id) : undefined}
              deleting={deleteMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoTile({ photo, onDelete, deleting }: {
  photo: CabinetPhoto
  onDelete?: () => void
  deleting: boolean
}) {
  return (
    <div className="relative group rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 aspect-square">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaApi.toFullUrl(photo.url)}
        alt={photo.caption ?? ''}
        className="w-full h-full object-cover"
      />
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={deleting}
          title="Удалить"
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 cursor-pointer"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-linear-to-t from-black/60 to-transparent">
          <p className="text-xs text-white truncate">{photo.caption}</p>
        </div>
      )}
    </div>
  )
}

// ─── Users tab ───────────────────────────────────────────────────────────────

function UsersTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-users', cabinetId],
    queryFn: () => cabinetsApi.getCabinetUsers(cabinetId),
  })

  const removeMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) =>
      cabinetsApi.removeCabinetUser(cabinetId, userId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-users', cabinetId] })
      toast.success('Пользователь откреплён')
    },
    onError: () => toast.error('Ошибка при откреплении'),
  })

  const users = data ?? []

  if (isLoading) {
    return (
      <div className="space-y-2 px-6 py-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <UsersIcon className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Нет привязанных пользователей</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
      {users.map(u => (
        <UserRow
          key={u.user_id}
          user={u}
          isAdmin={isAdmin}
          onRemove={(reason) => removeMut.mutate({ userId: u.user_id, reason })}
          removing={removeMut.isPending}
        />
      ))}
    </div>
  )
}

function UserRow({ user, isAdmin, onRemove, removing }: {
  user: CabinetUser
  isAdmin: boolean
  onRemove: (reason: string) => void
  removing: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="px-6 py-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
          <UsersIcon className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
              {user.full_name ?? user.phone ?? `#${user.user_id}`}
            </p>
            {user.is_primary && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shrink-0">
                Основной
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {user.phone && (
              <span className="text-xs text-slate-400">{user.phone}</span>
            )}
            {user.custom_name && (
              <span className="text-xs text-slate-400 italic">«{user.custom_name}»</span>
            )}
            <span className="text-xs text-slate-400">с {fmtDate(user.added_at)}</span>
          </div>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            title="Открепить"
            className="w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 space-y-2 pl-12">
          <label className="text-xs font-medium text-slate-500 block">
            Причина открепления <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Укажите причину"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 resize-none focus:outline-none focus:border-[#4A8FE7]"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => { setShowForm(false); setReason('') }}
              disabled={removing}
              className="h-7 text-xs px-2 cursor-pointer"
            >
              Отмена
            </Button>
            <Button
              onClick={() => { onRemove(reason); setShowForm(false); setReason('') }}
              disabled={!reason.trim() || removing}
              className="h-7 text-xs px-3 bg-red-500 hover:bg-red-600 cursor-pointer"
            >
              {removing ? 'Откреп...' : 'Открепить'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Info tab helpers ────────────────────────────────────────────────────────

function DetailRow({ label, value, editing, onChange, placeholder, multiline }: {
  label: string
  value: string
  editing: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder: string
  multiline?: boolean
}) {
  const isEmpty = !value.trim()
  return (
    <div className="flex gap-4 px-6 py-3">
      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={2}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-200 focus:border-[#4A8FE7] outline-none placeholder:text-slate-300 placeholder:italic resize-none py-0"
          />
        ) : (
          <input
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-200 focus:border-[#4A8FE7] outline-none placeholder:text-slate-300 placeholder:italic"
          />
        )
      ) : (
        <span className={`flex-1 text-sm ${isEmpty ? 'text-slate-300 italic' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
          {isEmpty ? placeholder : value}
        </span>
      )}
    </div>
  )
}

function DateRow({ label, value, editing, onChange }: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
}) {
  const display = value ? formatDate(new Date(value).toISOString()) : ''
  return (
    <div className="flex gap-4 px-6 py-3">
      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
      {editing ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm text-slate-700 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#4A8FE7]"
        />
      ) : (
        <span className={`text-sm ${display ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-300 italic'}`}>
          {display || 'Не указана'}
        </span>
      )}
    </div>
  )
}

// ─── Types / helpers ─────────────────────────────────────────────────────────

interface FormFields {
  admin_internal_name: string
  object_number: string
  type: string
  description: string
  purpose: string
  admin_comment: string
  warranty_start: string
  warranty_end: string
}

function cabinetToFields(c: Cabinet): FormFields {
  return {
    admin_internal_name: c.admin_internal_name ?? '',
    object_number: c.object_number,
    type: c.type ?? '',
    description: c.description ?? '',
    purpose: c.purpose ?? '',
    admin_comment: c.admin_comment ?? '',
    warranty_start: c.warranty_starts_at?.slice(0, 10) ?? '',
    warranty_end: c.warranty_ends_at?.slice(0, 10) ?? '',
  }
}

function fieldsToDto(f: FormFields): UpdateCabinetDto {
  return {
    admin_internal_name: f.admin_internal_name || null,
    object_number: f.object_number || undefined,
    type: f.type || null,
    description: f.description || null,
    purpose: f.purpose || null,
    admin_comment: f.admin_comment || null,
    warranty_starts_at: f.warranty_start ? new Date(f.warranty_start).toISOString() : null,
    warranty_ends_at: f.warranty_end ? new Date(f.warranty_end).toISOString() : null,
  }
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div>
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl bg-white/20" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40 bg-white/20" />
            <Skeleton className="h-3 w-24 bg-white/20" />
          </div>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function BoardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  )
}
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}
function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
}
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}
function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  )
}
