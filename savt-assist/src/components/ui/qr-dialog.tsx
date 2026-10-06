'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  // Подпись под заголовком — название проекта / номер ШУ.
  name?: string
  fileName: string
  // Ключ кэша: у проекта и ШУ свои QR, а id могут совпадать.
  queryKey: readonly unknown[]
  load: () => Promise<Blob>
}

// Общее окно «QR-код» для проекта и ШУ — оба эндпоинта (GET /admin/projects/
// {id}/qr и GET /admin/cabinets/{id}/qr) отдают PNG, различается только откуда
// его брать.
export function QrDialog({ open, onClose, title, name, fileName, queryKey, load }: Props) {
  const { data: blob, isLoading, isError } = useQuery({
    queryKey,
    queryFn: load,
    enabled: open,
  })

  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const handleDownload = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {name && <p className="text-sm text-slate-400">{name}</p>}
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {isLoading && <Skeleton className="w-56 h-56 rounded-xl" />}

          {isError && (
            <div className="w-56 h-56 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
              <AlertTriangle className="w-8 h-8" />
              <span className="text-sm">Не удалось загрузить QR</span>
            </div>
          )}

          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`${title} ${name ?? ''}`}
              className="w-56 h-56 rounded-xl border border-slate-100 object-contain"
            />
          )}

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
              Закрыть
            </Button>
            {url && (
              <Button
                className="flex-1 bg-[#1B3A72] hover:bg-[#1B3A72]/90 gap-2 cursor-pointer dark:text-slate-50"
                onClick={handleDownload}
              >
                <DownloadIcon />
                Скачать
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}
