'use client'

import { useRef } from 'react'
import { X, Bot, User, Video, Mic as MicIconLucide } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toFullUrl, downloadBlob } from './attachment-view'
import { EmptyAttach, FileTypeIcon, OpenExtIcon, DownloadSmIcon } from './chat-icons'
import { WALLPAPERS } from './wallpapers'
import type { ChatColors } from './hooks/use-chat-settings'

type AllAttachments = {
  media: { message_id: number; url: string; mime: string }[]
  files: { message_id: number; name: string; url: string; mime: string; size: number }[]
  voices: { message_id: number; url: string; duration: number | null }[]
}

type AttachTab = 'media' | 'files' | 'voice' | 'colors' | 'wallpaper'

interface Props {
  onClose: () => void
  name: string
  avatarBg: string
  AvatarIcon: React.ComponentType<{ className?: string }>
  botActive: boolean
  hideBotControls?: boolean
  attachTab: AttachTab
  onTabChange: (tab: AttachTab) => void
  allAttachments: AllAttachments
  onOpenImage: (fullUrl: string) => void
  onJumpToMessage: (messageId: number) => void
  onContextMenu: (e: React.MouseEvent, messageId: number) => void
  chatColors: ChatColors
  saveColor: (key: keyof ChatColors, value: string | number | undefined) => void
  colorScope: 'chat' | 'global'
  onColorScopeChange: (scope: 'chat' | 'global') => void
  wallpaper: string
  customWallpaperUrl: string | null
  onSelectWallpaper: (id: string) => void
  onResetWallpaper: () => void
  onUploadWallpaper: (file: File) => Promise<void>
  uploadingWallpaper: boolean
  isDarkMode: boolean
}

// Модалка «Информация о чате»: медиа/файлы/голосовые чата + личные настройки вида
// (цвета, обои). Самый крупный по объёму JSX-блок ChatConversation — вынесен сюда,
// чтобы не раздувать основной файл (см. разбор декомпозиции chat-conversation.tsx).
export function ChatAttachmentsPanel({
  onClose, name, avatarBg, AvatarIcon, botActive, hideBotControls, attachTab, onTabChange, allAttachments,
  onOpenImage, onJumpToMessage, onContextMenu,
  chatColors, saveColor, colorScope, onColorScopeChange,
  wallpaper, customWallpaperUrl, onSelectWallpaper, onResetWallpaper, onUploadWallpaper, uploadingWallpaper,
  isDarkMode,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      {/* min-w-0 — карточка это flex-item родительского flex-контейнера, без min-w-0
          не сжимается ниже ширины контента и вылезает шире max-w-lg, см. cabinet-detail-dialog.tsx */}
      <div className="relative w-full min-w-0 max-w-lg mx-4 max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Информация о чате</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
          <div className={cn('w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0', avatarBg)}>
            <AvatarIcon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-base truncate">{name}</p>
            {!hideBotControls && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                {botActive ? <><Bot className="w-3.5 h-3.5" />Бот отвечает</> : <><User className="w-3.5 h-3.5" />Оператор отвечает</>}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 px-4 py-2 border-b border-slate-100 dark:border-slate-700/60 shrink-0 flex-wrap">
          {(['media', 'files', 'voice', 'colors', 'wallpaper'] as const).map(tab => {
            const labels: Record<string, string> = {
              media: `Медиа (${allAttachments.media.length})`,
              files: `Файлы (${allAttachments.files.length})`,
              voice: `Голосовые (${allAttachments.voices.length})`,
              colors: 'Цвета',
              wallpaper: 'Обои',
            }
            return (
              <button key={tab} onClick={() => onTabChange(tab)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer', attachTab === tab ? 'bg-[#1B3A72] text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
                {labels[tab]}
              </button>
            )
          })}
        </div>
        {/* min-h-0 — иначе flex-1 не сжимается ниже контента и модалка вылезает
            за max-h-[85vh] вместо внутреннего скролла (см. cabinet-detail-dialog.tsx) */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {attachTab === 'media' && (
            allAttachments.media.length === 0
              ? <EmptyAttach label="Нет медиафайлов" />
              : <div className="grid grid-cols-3 gap-0.5 p-0.5">
                {allAttachments.media.map((item, i) => {
                  const fullUrl = toFullUrl(item.url)
                  return (
                    <div key={i} className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden relative group cursor-pointer"
                      onClick={() => {
                        if (item.mime.startsWith('image/')) onOpenImage(fullUrl)
                        else onJumpToMessage(item.message_id)
                      }}
                      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item.message_id) }}>
                      {item.mime.startsWith('image/')
                        ? <img src={fullUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center text-slate-400"><Video className="w-6 h-6" /></div>
                      }
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                    </div>
                  )
                })}
              </div>
          )}
          {attachTab === 'files' && (
            allAttachments.files.length === 0
              ? <EmptyAttach label="Нет файлов" />
              : <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {allAttachments.files.map((item, i) => {
                  const fullUrl = toFullUrl(item.url)
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item.message_id) }}>
                      <FileTypeIcon mime={item.mime} className="w-6 h-6 shrink-0 text-slate-400" />
                      <div className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => window.open(fullUrl, '_blank')}>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {item.size > 0 ? `${(item.size / 1024).toFixed(0)} КБ` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-colors"
                          title="Открыть">
                          <OpenExtIcon />
                        </a>
                        <button onClick={e => { e.stopPropagation(); downloadBlob(fullUrl, item.name) }}
                          className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-colors cursor-pointer"
                          title="Скачать">
                          <DownloadSmIcon />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
          )}
          {attachTab === 'voice' && (
            allAttachments.voices.length === 0
              ? <EmptyAttach label="Нет голосовых сообщений" />
              : <div className="divide-y divide-slate-100 dark:divide-slate-700/60 px-4 py-1">
                {allAttachments.voices.map((item, i) => (
                  <div key={i} className="py-2.5"
                    onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item.message_id) }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MicIconLucide className="w-3.5 h-3.5" />
                        {item.duration != null ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : 'Голосовое'}
                      </p>
                      <button
                        onClick={() => onJumpToMessage(item.message_id)}
                        className="text-[10px] font-medium text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer">
                        В чат ↗
                      </button>
                    </div>
                    <audio controls src={toFullUrl(item.url)} className="w-full h-8" />
                  </div>
                ))}
              </div>
          )}
          {attachTab === 'colors' && (
            <div className="p-4 space-y-5">
              <div className="flex gap-2">
                <button onClick={() => onColorScopeChange('chat')}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer', colorScope === 'chat' ? 'bg-[#1B3A72] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                  Этот чат
                </button>
                <button onClick={() => onColorScopeChange('global')}
                  className={cn('flex-1 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer', colorScope === 'global' ? 'bg-[#1B3A72] text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700')}>
                  Все чаты
                </button>
              </div>
              <ColorSection
                title="Мои сообщения"
                value={chatColors.ownBubble}
                onChange={(v) => saveColor('ownBubble', v)}
                colors={['#1B3A72', '#1d4ed8', '#7c3aed', '#db2777', '#059669', '#0891b2', '#374151', '#dc2626']}
              />
              <ColorSection
                title="Сообщения собеседника"
                value={chatColors.otherBubble}
                onChange={(v) => saveColor('otherBubble', v)}
                colors={['#f1f5f9', '#fef3c7', '#d1fae5', '#e0e7ff', '#fce7f3', '#f0fdf4', '#fff7ed', '#fdf2f8']}
              />
              <ColorSection
                title="Сообщения бота"
                value={chatColors.botBubble}
                onChange={(v) => saveColor('botBubble', v)}
                colors={['#eef2ff', '#e0e7ff', '#ede9fe', '#fce7f3', '#dcfce7', '#cffafe', '#fef9c3', '#fee2e2']}
              />
              <ColorSection
                title="Текст моих сообщений"
                value={chatColors.ownText}
                onChange={(v) => saveColor('ownText', v)}
                colors={['#ffffff', '#f0f9ff', '#fef9c3', '#dcfce7', '#ffe4e6', '#f3e8ff', '#ffedd5', '#e0f2fe']}
              />
              <ColorSection
                title="Текст собеседника"
                value={chatColors.otherText}
                onChange={(v) => saveColor('otherText', v)}
                colors={['#1e293b', '#1e3a5f', '#3b0764', '#831843', '#14532d', '#164e63', '#713f12', '#7f1d1d']}
              />
              <ColorSection
                title="Текст бота"
                value={chatColors.botText}
                onChange={(v) => saveColor('botText', v)}
                colors={['#1e293b', '#3730a3', '#1e40af', '#5b21b6', '#065f46', '#0e7490', '#92400e', '#991b1b']}
              />
              <ColorSection
                title="Цвет никнеймов"
                value={chatColors.nickColor}
                onChange={(v) => saveColor('nickColor', v)}
                colors={['#1B3A72', '#2563eb', '#7c3aed', '#be185d', '#065f46', '#0e7490', '#92400e', '#dc2626']}
              />
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Размер шрифта</p>
                <div className="flex items-center gap-2">
                  {([12, 13, 14, 15, 16, 18] as const).map(size => (
                    <button
                      key={size}
                      onClick={() => saveColor('fontSize', chatColors.fontSize === size ? undefined : size)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border',
                        chatColors.fontSize === size
                          ? 'bg-[#1B3A72] text-white border-transparent'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {attachTab === 'wallpaper' && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {WALLPAPERS.map(wp => (
                  <button key={wp.id}
                    onClick={() => onSelectWallpaper(wp.id)}
                    className={cn('h-20 rounded-xl border-2 flex items-end justify-center pb-2 transition-all cursor-pointer overflow-hidden', wallpaper === wp.id && !customWallpaperUrl ? 'border-[#1B3A72] scale-95 shadow-md' : 'border-transparent hover:scale-95')}
                    style={{ background: isDarkMode ? wp.dark : wp.light }}>
                    <span className="text-[10px] font-semibold text-white drop-shadow px-1.5 py-0.5 rounded-full bg-black/25">{wp.label}</span>
                  </button>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Своё изображение</p>
                <div className="flex items-center gap-2">
                  <label className={cn('flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:border-[#1B3A72] hover:text-[#1B3A72] dark:hover:border-blue-400 dark:hover:text-blue-400 cursor-pointer transition-colors', uploadingWallpaper && 'opacity-50 pointer-events-none')}>
                    {uploadingWallpaper ? (
                      <div className="w-4 h-4 border-2 border-[#1B3A72] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    )}
                    {uploadingWallpaper ? 'Загрузка...' : 'Загрузить'}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      e.target.value = ''
                      await onUploadWallpaper(file)
                    }} />
                  </label>
                  {customWallpaperUrl && (
                    <>
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 border-[#1B3A72]">
                        <img src={customWallpaperUrl} alt="Custom" className="w-full h-full object-cover" />
                      </div>
                      <button
                        onClick={onResetWallpaper}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ColorSection({ title, value, onChange, colors }: {
  title: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  colors: string[]
}) {
  const isCustom = value !== undefined && !colors.includes(value)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">{title}</p>

      <div className="flex flex-wrap gap-2 items-center">
        {/* По умолчанию */}
        <button
          onClick={() => onChange(undefined)}
          title="По умолчанию"
          className={cn(
            'w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shrink-0',
            !value ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 ring-2 ring-[#1B3A72]/20' : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-slate-400'
          )}
        ><X className="w-3.5 h-3.5" /></button>

        {/* Пресеты */}
        {colors.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            className={cn(
              'w-8 h-8 rounded-lg border-2 transition-all cursor-pointer shrink-0',
              value === c ? 'border-[#1B3A72] scale-110 shadow-md ring-2 ring-[#1B3A72]/20' : 'border-transparent hover:scale-105 hover:shadow-sm'
            )}
            style={{ backgroundColor: c }}
          />
        ))}

        {/* Активный кастомный цвет (если не в списке) */}
        {isCustom && (
          <button
            onClick={() => inputRef.current?.click()}
            title={value}
            className="w-8 h-8 rounded-lg border-2 border-[#1B3A72] scale-110 shadow-md ring-2 ring-[#1B3A72]/20 transition-all shrink-0 cursor-pointer"
            style={{ backgroundColor: value }}
          />
        )}

        {/* Кнопка «+» с нативным color picker */}
        <label
          className={cn(
            'w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer shrink-0 relative overflow-hidden',
            isCustom
              ? 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
              : 'border-dashed border-slate-400 dark:border-slate-500 hover:border-[#1B3A72] dark:hover:border-blue-400'
          )}
        >
          <input
            ref={inputRef}
            type="color"
            value={value || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
          />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 select-none">+</span>
        </label>
      </div>

      {/* Текстовый ввод HEX для кастомного цвета */}
      {isCustom && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const hex = e.target.value
              if (/^#[0-9A-Fa-f]{6}$/.test(hex)) onChange(hex)
            }}
            className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-24 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#1B3A72]/20"
            maxLength={7}
            placeholder="#000000"
          />
          <span className="text-[10px] text-slate-400 font-medium">HEX</span>
        </div>
      )}
    </div>
  )
}
