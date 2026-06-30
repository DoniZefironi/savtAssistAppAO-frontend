'use client'

import { useMemo, useRef, useState } from 'react'
import { API_URL } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import type { MessageAttachment } from '@/types'

export function toFullUrl(url: string): string {
  if (!url) return ''
  return url.startsWith('http') ? url : `${API_URL}${url}`
}

export async function downloadBlob(url: string, filename: string) {
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

interface Props {
  attachment: MessageAttachment
  isOwn: boolean
  transcription?: string
  transcribing?: boolean
  onTranscribe?: () => void
}

export function AttachmentView({ attachment, isOwn, transcription, transcribing, onTranscribe }: Props) {
  const { mime_type } = attachment
  if (mime_type.startsWith('image/')) return <ImageAttachment a={attachment} isOwn={isOwn} />
  if (mime_type.startsWith('audio/')) return <AudioAttachment a={attachment} isOwn={isOwn} transcription={transcription} transcribing={transcribing} onTranscribe={onTranscribe} />
  if (mime_type.startsWith('video/')) return <VideoAttachment a={attachment} isOwn={isOwn} />
  return <FileAttachment a={attachment} isOwn={isOwn} />
}

function ImageAttachment({ a, isOwn }: { a: MessageAttachment; isOwn: boolean }) {
  const [lightbox, setLightbox] = useState(false)
  const url = toFullUrl(a.file_url)

  return (
    <>
      <div className="relative group mt-1 max-w-xs">
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
            className="w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 cursor-pointer"
            title="Скачать"
          >
            <DownloadIcon size={14} />
          </button>
          <button
            onClick={() => setLightbox(true)}
            className="w-7 h-7 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/70 cursor-pointer"
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

function seededBars(seed: string, count: number): number[] {
  let s = 5381
  for (let i = 0; i < seed.length; i++) s = ((s * 33) ^ seed.charCodeAt(i)) >>> 0
  return Array.from({ length: count }, () => {
    s = ((s * 1664525) + 1013904223) >>> 0
    return 12 + ((s >>> 16) % 68)
  })
}

function AudioAttachment({ a, isOwn, transcription, transcribing, onTranscribe }: {
  a: MessageAttachment
  isOwn: boolean
  transcription?: string
  transcribing?: boolean
  onTranscribe?: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const url = toFullUrl(a.file_url)
  const isVoice = a.file_name === 'Голосовое сообщение' || a.mime_type.includes('ogg') || a.mime_type.includes('webm')
  const bars = useMemo(() => seededBars(a.file_url, 34), [a.file_url])
  const duration = a.duration_seconds ?? 0
  const displayTime = playing && elapsed > 0 ? formatDuration(elapsed) : formatDuration(duration)

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    playing ? el.pause() : el.play()
  }

  return (
    <div className={cn('mt-1 rounded-2xl overflow-hidden', isOwn ? 'bg-white/15' : 'bg-slate-100 dark:bg-slate-700')}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setElapsed(0) }}
        onTimeUpdate={() => {
          const el = audioRef.current
          if (el && el.duration && !isNaN(el.duration)) {
            setProgress(el.currentTime / el.duration)
            setElapsed(Math.round(el.currentTime))
          }
        }}
      />

      <div className="flex items-center gap-2.5 px-2.5 py-2.5 min-w-[220px]">
        <button
          onClick={toggle}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors',
            isOwn ? 'bg-white/25 hover:bg-white/40 text-white' : 'bg-[#1B3A72] hover:bg-[#1B3A72]/80 text-white dark:bg-blue-600 dark:hover:bg-blue-500'
          )}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
          <div className="flex items-end gap-[1.5px] h-8">
            {bars.map((pct, i) => {
              const filled = progress > 0 && (i / bars.length) <= progress
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 rounded-full min-w-[2px]',
                    isOwn
                      ? (filled ? 'bg-white/90' : 'bg-white/30')
                      : (filled ? 'bg-[#1B3A72] dark:bg-slate-200' : 'bg-[#1B3A72]/25 dark:bg-white/25')
                  )}
                  style={{ height: `${pct}%` }}
                />
              )
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className={cn('text-[10px]', isOwn ? 'text-white/55' : 'text-slate-400 dark:text-slate-300')}>
              {isVoice ? '🎙 ' : '🎵 '}{displayTime || '0:00'}
            </span>
            <div className="flex items-center gap-1.5">
              {onTranscribe && !transcription && (
                <button
                  onClick={onTranscribe}
                  disabled={transcribing}
                  title="Распознать текст"
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-colors',
                    isOwn
                      ? 'bg-white/20 hover:bg-white/30 text-white disabled:opacity-50'
                      : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300 disabled:opacity-50'
                  )}
                >
                  {transcribing ? <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> : 'T'}
                </button>
              )}
              <button
                onClick={() => downloadBlob(url, a.file_name)}
                title="Скачать"
                className={cn('cursor-pointer transition-colors', isOwn ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200')}
              >
                <DownloadIcon size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {transcription && (
        <p className={cn('text-xs px-2.5 pb-2.5 leading-relaxed border-t', isOwn ? 'border-white/15 text-white/80' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300')}>
          {transcription}
        </p>
      )}
    </div>
  )
}

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

function FileAttachment({ a, isOwn }: { a: MessageAttachment; isOwn: boolean }) {
  const url = toFullUrl(a.file_url)

  return (
    <div className={cn(
      'mt-1 rounded-xl px-3 py-2.5 flex items-center gap-3 min-w-[220px] max-w-xs',
      isOwn
        ? 'bg-white/25 border border-white/35'
        : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm'
    )}>
      <span className="text-2xl flex-shrink-0">{fileIcon(a.mime_type)}</span>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate leading-tight', isOwn ? 'text-white' : 'text-slate-800 dark:text-slate-100')}>
          {a.file_name}
        </p>
        {a.file_size_bytes > 0 && (
          <p className={cn('text-xs mt-0.5', isOwn ? 'text-white/60' : 'text-slate-500 dark:text-slate-400')}>
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
            isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300'
          )}
          title="Открыть"
        >
          <OpenIcon />
        </a>
        <button
          onClick={() => downloadBlob(url, a.file_name)}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer',
            isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-600 dark:text-slate-300'
          )}
          title="Скачать"
        >
          <DownloadIcon size={14} />
        </button>
      </div>
    </div>
  )
}

export function ImageLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-black/50">
        <span className="text-white/80 text-sm truncate max-w-xs">{name}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); downloadBlob(url, name) }}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
          >
            <DownloadIcon size={16} />
            Скачать
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <img
        src={url}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
      />
    </div>
  )
}

function PlayIcon() {
  return (
    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  )
}

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
