'use client'

import { Paperclip, Image as ImageIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SendIcon, PaperclipIcon, MicIcon, StickerIcon } from './chat-icons'
import type { useVoiceRecorder } from '@/lib/hooks/use-voice-recorder'
import type { ChatMessage, MessageAttachment } from '@/types'

export const STICKERS: Record<string, string[]> = {
  '😊': ['😀','😂','🥹','😍','🥰','😎','😢','😡','🤔','😴','🤗','🤩','😇','🥳','🙄','😬','🤐','😤'],
  '👍': ['👍','👎','❤️','💯','🙏','🤝','✌️','👏','🫡','💪','🤞','🫶','🎉','🔥','⭐','✨','💥','🎊'],
  '🐾': ['🐶','🐱','🐰','🦊','🐻','🐼','🐯','🦁','🐸','🐙','🦋','🌸','🌈','🍀','🌊','🔮','🎭','🎸'],
}

interface Props {
  stickerPickerOpen: boolean
  onToggleStickerPicker: () => void
  stickerCat: string
  onStickerCatChange: (cat: string) => void
  onPickSticker: (sticker: string) => void
  pendingAttachments: (MessageAttachment & { name: string })[]
  onRemoveAttachment: (i: number) => void
  replyTo: ChatMessage | null
  editingMessage: ChatMessage | null
  onCancelContext: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  voice: ReturnType<typeof useVoiceRecorder>
  canSend: boolean
  uploadingFile: boolean
  text: string
  onTextChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputDisabled: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onSend: () => void
}

// Нижняя панель ввода: стикеры, превью вложений/ответа/редактирования, текстовое
// поле и кнопка отправки/голосовой записи. Рендерится только когда бот неактивен,
// поиск закрыт и не идёт множественный выбор — см. условие в ChatConversation.
export function ChatComposer({
  stickerPickerOpen, onToggleStickerPicker, stickerCat, onStickerCatChange, onPickSticker,
  pendingAttachments, onRemoveAttachment, replyTo, editingMessage, onCancelContext,
  fileInputRef, onFileChange, voice, canSend, uploadingFile,
  text, onTextChange, onKeyDown, inputDisabled, textareaRef, onSend,
}: Props) {
  return (
    <>
      {stickerPickerOpen && (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 px-3 pt-2 pb-1 shrink-0">
          <div className="max-w-[100rem] mx-auto">
          <div className="flex gap-1 mb-2">
            {Object.keys(STICKERS).map(cat => (
              <button key={cat} onClick={() => onStickerCatChange(cat)}
                className={cn('text-xl p-1.5 rounded-lg transition-colors cursor-pointer', stickerCat === cat ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-9 gap-0.5 pb-1">
            {STICKERS[stickerCat].map(sticker => (
              <button key={sticker}
                onClick={() => onPickSticker(sticker)}
                className="text-2xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors aspect-square flex items-center justify-center">
                {sticker}
              </button>
            ))}
          </div>
          </div>
        </div>
      )}

      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60">
          <div className="max-w-[100rem] mx-auto flex flex-wrap gap-2">
          {pendingAttachments.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300">
              {a.mime_type.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 shrink-0" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
              <span className="max-w-32 truncate">{a.name}</span>
              <button onClick={() => onRemoveAttachment(i)} className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      {(replyTo || editingMessage) && (
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700/60">
          <div className="max-w-[100rem] mx-auto flex items-center gap-2">
          <div className={cn('w-0.5 h-8 rounded-full shrink-0', editingMessage ? 'bg-amber-400' : 'bg-[#4A8FE7]')} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {editingMessage ? 'Редактирование' : `Ответ: ${replyTo!.sender_name}`}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
              {editingMessage
                ? (editingMessage.text ?? '')
                : replyTo!.text
                ? replyTo!.text
                : replyTo!.attachments?.length
                ? <><Paperclip className="w-3 h-3 shrink-0" />Вложение</>
                : ''}
            </p>
          </div>
          <button onClick={onCancelContext} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0 p-1 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          </div>
        </div>
      )}

      <div className="px-3 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700/60 shrink-0">
      <div className="max-w-[100rem] mx-auto flex items-end gap-2">
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFileChange} multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov" />

        {voice.recording ? (
          <>
            <div className="flex-1 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-2xl px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Запись... {voice.seconds}с
              <button onClick={voice.cancel} className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">Отмена</button>
            </div>
            <button onClick={voice.stop} className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shrink-0 cursor-pointer"><SendIcon /></button>
          </>
        ) : (
          <>
            <button onClick={() => fileInputRef.current?.click()} disabled={!canSend || uploadingFile}
              className="w-9 h-9 rounded-full text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 disabled:opacity-40 cursor-pointer">
              {uploadingFile ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <PaperclipIcon />}
            </button>
            <button
              onClick={onToggleStickerPicker}
              className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer',
                stickerPickerOpen ? 'bg-[#1B3A72] text-white' : 'text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>
              <StickerIcon />
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={inputDisabled}
              placeholder={editingMessage ? 'Редактировать сообщение...' : 'Сообщение'}
              rows={1}
              className="flex-1 resize-none bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors max-h-32 overflow-y-auto leading-relaxed disabled:opacity-50"
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px' }}
            />
            {text.trim() || pendingAttachments.length > 0 || editingMessage ? (
              <button onClick={onSend} disabled={!canSend}
                className="w-10 h-10 rounded-full bg-[#1B3A72] flex items-center justify-center text-white hover:bg-[#1B3A72]/90 disabled:opacity-40 transition-all shrink-0 cursor-pointer">
                <SendIcon />
              </button>
            ) : (
              <button onClick={voice.start}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-[#1B3A72] hover:text-white transition-all shrink-0 cursor-pointer">
                <MicIcon />
              </button>
            )}
          </>
        )}
      </div>
      </div>
    </>
  )
}
