'use client'

import { useState } from 'react'
import { API_URL } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import type { MessageAttachment } from '@/types'

// Относительные пути /static/... → полный URL
function toFullUrl(url: string): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_URL}${url}`
}

// Скачивание через blob — обход ограничения cross-origin download атрибута
async function downloadBlob(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: 'include' })
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  } catch {
    // Fallback: открываем в новой вкладке если CORS не позволяет blob fetch
    window.open(url, '_blank')
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fileIcon(mime: string): string {
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('doc')) return '📝'
  if (mime.includes('excel') || mime.includes('sheet') || mime.includes('xls')) return '📊'
  if (mime.includes('video')) return '🎬'
  if (mime.includes('zip') || mime.includes('archive')) return '🗜'
  return '📎'
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  attachment: MessageAttachment
  isOwn: boolean
}

export function AttachmentView({ attachment, isOwn }: Props) {
  const { mime_type } = attachment
  if (mime_type.startsWith('image/')) return <ImageAttachment a={attachment} isOwn={isOwn} />
  if (mime_type.startsWith('audio/')) return <AudioAttachment a={attachment} isOwn={isOwn} />
  if (mime_type.startsWith('video/')) return <VideoAttachment a={attachment} isOwn={isOwn} />
  return <FileAttachment a={attachment} isOwn={isOwn} />
}

// ─── Image ────────────────────────────────────────────────────────────────────

function ImageAttachment({ a, isOwn }: { a: MessageAttachment; isOwn: boolean }) {
  const [lightbox, setLightbox] = useState(false)
  const url = toFullUrl(a.file_url)

  return (
    <>
      <div className="relative group mt-1 max-w-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={a.file_name}
          onClick={() => setLightbox(true)}
          className="rounded-xl max-w-full max-h-64 object-cover cursor-zoom-in block"
          loading="lazy"
        />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); downloadBlob(url, a.file_name) }}
            className="w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70"
            title="Скачать"
          >
            <DownloadIcon size={14} />
          </button>
          <button
            onClick={() => setLightbox(true)}
            className="w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70"
            title="Открыть"
          >
            <ExpandIcon />
          </button>
        </div>
      </div>
      {lightbox && <ImageLightbox url={url} name={a.file_name} onClose={() => setLightbox(false)} />}
    </>
  )
}

// ─── Audio ────────────────────────────────────────────────────────────────────

function AudioAttachment({ a, isOwn }: { a: MessageAttachment; isOwn: boolean }) {
  const url = toFullUrl(a.file_url)
  const isVoice = a.file_name === 'Голосовое сообщение' || a.mime_type.includes('ogg')

  return (
    <div className={cn(
      'mt-1 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[220px]',
      isOwn ? 'bg-white/15' : 'bg-slate-100'
    )}>
      <span className="text-lg flex-shrink-0">{isVoice ? '🎙' : '🎵'}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs mb-1 truncate', isOwn ? 'text-white/70' : 'text-slate-500')}>
          {isVoice ? 'Голосовое сообщение' : a.file_name}
          {a.duration_seconds != null && <span className="ml-1">{formatDuration(a.duration_seconds)}</span>}
        </p>
        <audio controls src={url} className="h-7 w-full" style={{ colorScheme: isOwn ? 'dark' : 'light' }}>
          Ваш браузер не поддерживает аудио
        </audio>
      </div>
      <button onClick={() => downloadBlob(url, a.file_name)} className={cn('flex-shrink-0', isOwn ? 'text-white/60 hover:text-white' : 'text-slate-400 hover:text-slate-700')} title="Скачать">
        <DownloadIcon size={16} />
      </button>
    </div>
  )
}

// ─── Video ────────────────────────────────────────────────────────────────────

function VideoAttachment({ a, isOwn }: { a: MessageAttachment; isOwn: boolean }) {
  const url = toFullUrl(a.file_url)

  return (
    <div className="mt-1 relative group max-w-xs">
      <video
        src={url}
        controls
        className="rounded-xl max-w-full max-h-64 block"
        preload="metadata"
      />
      <a
        href={url}
        download={a.file_name}
        className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Скачать"
      >
        <DownloadIcon size={14} />
      </a>
    </div>
  )
}

// ─── File ─────────────────────────────────────────────────────────────────────

function FileAttachment({ a, isOwn }: { a: MessageAttachment; isOwn: boolean }) {
  const url = toFullUrl(a.file_url)

  return (
    <div className={cn(
      'mt-1 rounded-xl px-3 py-2.5 flex items-center gap-3 min-w-[220px] max-w-xs',
      isOwn
        ? 'bg-white/15 border border-white/20'
        : 'bg-white border border-slate-200 shadow-sm'
    )}>
      <span className="text-2xl flex-shrink-0">{fileIcon(a.mime_type)}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate leading-tight', isOwn ? 'text-white' : 'text-slate-800')}>
          {a.file_name}
        </p>
        {a.file_size_bytes > 0 && (
          <p className={cn('text-xs mt-0.5', isOwn ? 'text-white/60' : 'text-slate-500')}>
            {formatBytes(a.file_size_bytes)}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
            isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          )}
          title="Открыть"
        >
          <OpenIcon />
        </a>
        <button
          onClick={() => downloadBlob(url, a.file_name)}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
            isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          )}
          title="Скачать"
        >
          <DownloadIcon size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function ImageLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-black/50">
        <span className="text-white/80 text-sm truncate max-w-xs">{name}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); downloadBlob(url, name) }}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <DownloadIcon size={16} />
            Скачать
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
      />
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  )
}

function OpenIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  )
}
