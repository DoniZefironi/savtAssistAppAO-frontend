'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cabinetsApi } from '@/lib/api/cabinets'
import type { Cabinet } from '@/types'

interface Props {
  cabinet: Cabinet | null
  onClose: () => void
}

export function QrDialog({ cabinet, onClose }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!cabinet) return
    let objectUrl: string | null = null
    setLoading(true)
    setError(false)
    setUrl(null)

    cabinetsApi.getQr(cabinet.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [cabinet])

  const handleDownload = () => {
    if (!url || !cabinet) return
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${cabinet.admin_internal_name ?? cabinet.object_number}.png`
    a.click()
  }

  const displayName = cabinet?.admin_internal_name ?? cabinet?.object_number ?? ''

  return (
    <Dialog open={cabinet !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR-код ШУ</DialogTitle>
          <p className="text-sm text-slate-400">{displayName}</p>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {loading && (
            <Skeleton className="w-56 h-56 rounded-xl" />
          )}

          {error && (
            <div className="w-56 h-56 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="text-3xl">⚠</span>
              <span className="text-sm">Не удалось загрузить QR</span>
            </div>
          )}

          {url && (
            <img
              src={url}
              alt={`QR-код ${displayName}`}
              className="w-56 h-56 rounded-xl border border-slate-100 object-contain"
            />
          )}

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
              Закрыть
            </Button>
            {url && (
              <Button
                className="flex-1 bg-[#1B3A72] hover:bg-[#1B3A72]/90 gap-2 cursor-pointer"
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
