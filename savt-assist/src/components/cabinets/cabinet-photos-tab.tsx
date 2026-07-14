'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { mediaApi } from '@/lib/api/media'
import type { CabinetPhoto } from '@/lib/api/media'
import { fmtSize } from './cabinet-dialog-shared'
import { ImageIcon, PencilIcon, TrashIcon, UploadIcon, XIcon, ChevronLeftIcon, ChevronRightIcon } from './cabinet-dialog-icons'

export function PhotosTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CabinetPhoto | null>(null)

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
      setDeleteTarget(null)
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, caption, sort_order }: { id: number; caption: string | null; sort_order: number }) =>
      mediaApi.updatePhoto(id, caption, sort_order),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet-photos', cabinetId] })
      toast.success('Фото обновлено')
    },
    onError: () => toast.error('Ошибка при обновлении'),
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
          {photos.map((photo, idx) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              onOpen={() => setLightboxIdx(idx)}
              onDelete={isAdmin ? () => setDeleteTarget(photo) : undefined}
              onUpdate={isAdmin ? (cap, order) => updateMut.mutate({ id: photo.id, caption: cap, sort_order: order }) : undefined}
              deleting={deleteMut.isPending}
              updating={updateMut.isPending}
            />
          ))}
        </div>
      )}

      {lightboxIdx !== null && (
        <PhotoLightbox
          photos={photos}
          initialIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {deleteTarget && (
        <AppModal open onClose={() => setDeleteTarget(null)}>
          <div className="px-6 py-5 min-w-0">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">Удалить фото?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 wrap-break-word">
              {deleteTarget.caption ? <><strong>«{deleteTarget.caption}»</strong> будет удалено безвозвратно.</> : 'Фото будет удалено безвозвратно.'}
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

function PhotoTile({ photo, onOpen, onDelete, onUpdate, deleting, updating }: {
  photo: CabinetPhoto
  onOpen: () => void
  onDelete?: () => void
  onUpdate?: (caption: string | null, sortOrder: number) => void
  deleting: boolean
  updating: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editCaption, setEditCaption] = useState(photo.caption ?? '')
  const [editOrder, setEditOrder] = useState(String(photo.sort_order))

  const handleSave = () => {
    onUpdate?.(editCaption.trim() || null, parseInt(editOrder) || 0)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditCaption(photo.caption ?? '')
    setEditOrder(String(photo.sort_order))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="relative rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 aspect-square">
        <img src={mediaApi.toFullUrl(photo.url)} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-black/60 flex flex-col gap-2 p-3">
          <textarea
            value={editCaption}
            onChange={e => setEditCaption(e.target.value)}
            placeholder="Подпись..."
            rows={2}
            className="w-full text-xs px-2 py-1 rounded-lg bg-white/90 text-slate-800 resize-none outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-xs shrink-0">Порядок</span>
            <input
              type="number"
              value={editOrder}
              onChange={e => setEditOrder(e.target.value)}
              className="w-16 text-xs px-2 py-0.5 rounded bg-white/90 text-slate-800 outline-none"
            />
          </div>
          <div className="flex gap-1.5 mt-auto">
            <button onClick={handleCancel} className="flex-1 text-xs py-1 rounded-lg bg-white/20 text-white hover:bg-white/30 cursor-pointer transition-colors">
              Отмена
            </button>
            <button onClick={handleSave} disabled={updating} className="flex-1 text-xs py-1 rounded-lg bg-[#1B3A72] text-white hover:bg-[#1B3A72]/80 cursor-pointer transition-colors disabled:opacity-50">
              {updating ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 aspect-square cursor-pointer" onClick={onOpen}>
      <img
        src={mediaApi.toFullUrl(photo.url)}
        alt={photo.caption ?? ''}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
      />
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onUpdate && (
          <button
            onClick={e => { e.stopPropagation(); setEditing(true) }}
            title="Редактировать"
            className="w-7 h-7 rounded-lg bg-black/50 flex items-center justify-center text-white hover:bg-[#1B3A72]/80 cursor-pointer"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            disabled={deleting}
            title="Удалить"
            className="w-7 h-7 rounded-lg bg-black/50 flex items-center justify-center text-white hover:bg-red-500/80 cursor-pointer"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {photo.caption && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-linear-to-t from-black/60 to-transparent">
          <p className="text-xs text-white truncate">{photo.caption}</p>
        </div>
      )}
    </div>
  )
}

function PhotoLightbox({ photos, initialIdx, onClose }: {
  photos: CabinetPhoto[]
  initialIdx: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIdx)
  const photo = photos[idx]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIdx(i => Math.min(photos.length - 1, i + 1))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, photos.length])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer z-10"
      >
        <XIcon className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-4 px-4 max-w-5xl w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setIdx(i => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer disabled:opacity-20"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
          <img
            src={mediaApi.toFullUrl(photo.url)}
            alt={photo.caption ?? ''}
            className="max-h-[75vh] max-w-full object-contain rounded-xl"
          />
          {photo.caption && (
            <p className="text-white/70 text-sm text-center">{photo.caption}</p>
          )}
          {photos.length > 1 && (
            <p className="text-white/40 text-xs">{idx + 1} / {photos.length}</p>
          )}
        </div>

        <button
          onClick={() => setIdx(i => Math.min(photos.length - 1, i + 1))}
          disabled={idx === photos.length - 1}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 transition-colors cursor-pointer disabled:opacity-20"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
