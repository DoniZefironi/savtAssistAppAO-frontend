'use client'

import { Pin, PinOff, Trash2, Ban, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchIcon, DotsVerticalIcon, HeaderMenuItem } from './chat-icons'

interface Props {
  onBack?: () => void
  searchOpen: boolean
  searchInput: string
  onSearchInputChange: (v: string) => void
  onToggleSearch: () => void
  name: string
  avatarBg: string
  AvatarIcon: React.ComponentType<{ className?: string }>
  botActive: boolean
  // Чаты сервисных заявок бота не имеют вообще (см. README-backend.md, "Рут `chats`" —
  // в отличие от `support`, у `service_request` нет "с ботом") — индикатор и кнопки
  // взять/вернуть боту для них не имеют смысла и предлагали бы включить бота там,
  // где он структурно никогда не участвует.
  hideBotControls?: boolean
  operatorRequested: boolean
  onAvatarClick: () => void
  onTake: () => void
  takePending: boolean
  onReturnToBot: () => void
  returnToBotPending: boolean
  headerMenuOpen: boolean
  onToggleHeaderMenu: () => void
  headerMenuRef: React.RefObject<HTMLDivElement | null>
  pinnedCount: number
  onJumpToPinned: () => void
  onUnpinAll: () => void
  onClearHistory: () => void
  onDeleteChat: () => void
}

// Верхняя панель разговора: аватар/имя/статус, поиск по сообщениям, взять/вернуть
// боту, выпадающее меню (⋮). Вынесена из ChatConversation как самостоятельный,
// самый заметный визуально блок шапки — см. разбор декомпозиции chat-conversation.tsx.
export function ChatHeader({
  onBack, searchOpen, searchInput, onSearchInputChange, onToggleSearch,
  name, avatarBg, AvatarIcon, botActive, hideBotControls, operatorRequested, onAvatarClick,
  onTake, takePending, onReturnToBot, returnToBotPending,
  headerMenuOpen, onToggleHeaderMenu, headerMenuRef,
  pinnedCount, onJumpToPinned, onUnpinAll, onClearHistory, onDeleteChat,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/60 shrink-0 shadow-sm">
      {onBack && (
        <button onClick={onBack} className="md:hidden text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mr-1 cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
        </button>
      )}
      <div
        className={cn('flex items-center gap-3 flex-1 min-w-0', !searchOpen && 'cursor-pointer hover:opacity-80 transition-opacity')}
        onClick={!searchOpen ? onAvatarClick : undefined}
      >
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0', avatarBg)}>
          <AvatarIcon className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {searchOpen ? (
            <input autoFocus value={searchInput} onChange={e => onSearchInputChange(e.target.value)}
              placeholder="Поиск по сообщениям..."
              className="w-full text-sm bg-slate-100 dark:bg-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:bg-slate-200 dark:focus:bg-slate-700 transition-colors" />
          ) : (
            <>
              <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{name}</p>
              {/* overflow-hidden — без него длинный статус не обрезался, а вылезал поверх кнопок справа */}
              <div className="flex items-center gap-2 mt-0.5 min-w-0 overflow-hidden">
                {!hideBotControls && (botActive
                  ? <span className="text-xs text-slate-400 flex items-center gap-1 min-w-0 shrink"><span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full shrink-0" /><span className="truncate">Бот отвечает</span></span>
                  : <span className="text-xs text-blue-500 flex items-center gap-1 min-w-0 shrink"><span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" /><span className="truncate">Оператор отвечает</span></span>
                )}
                {operatorRequested && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium shrink-0">Ожидает оператора</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {/* На мобильном поиск и взять/вернуть чат скрыты в меню «⋮» — в шапке остаётся только
            иконка поиска, если он уже открыт (нужна, чтобы его закрыть) */}
        <button onClick={onToggleSearch} title={searchOpen ? 'Закрыть поиск' : 'Поиск'}
          className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer',
            searchOpen ? 'flex bg-[#1B3A72] text-white' : 'hidden sm:flex text-slate-400 hover:text-[#1B3A72] hover:bg-slate-100 dark:hover:bg-slate-800')}>
          <SearchIcon />
        </button>
        {!searchOpen && !hideBotControls && botActive && (
          <button onClick={onTake} disabled={takePending}
            className="hidden sm:block text-xs bg-[#1B3A72] text-white px-3 py-1.5 rounded-lg hover:bg-[#1B3A72]/90 transition-colors font-medium cursor-pointer">
            {takePending ? '...' : 'Взять чат'}
          </button>
        )}
        {!searchOpen && !hideBotControls && !botActive && (
          <button onClick={onReturnToBot} disabled={returnToBotPending}
            className="hidden sm:block text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
            Вернуть боту
          </button>
        )}
        <div className="relative" ref={headerMenuRef}>
          <button onClick={onToggleHeaderMenu}
            className={cn('w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer',
              headerMenuOpen ? 'bg-slate-100 dark:bg-slate-800 text-[#1B3A72]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800')}>
            <DotsVerticalIcon />
          </button>
          {headerMenuOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 min-w-52 z-50">
              {!searchOpen && (
                <div className="sm:hidden">
                  <HeaderMenuItem icon={<SearchIcon />} onClick={onToggleSearch}>Поиск</HeaderMenuItem>
                  {!hideBotControls && (botActive ? (
                    <HeaderMenuItem icon={<Bot className="w-4 h-4" />} onClick={onTake}>Взять чат</HeaderMenuItem>
                  ) : (
                    <HeaderMenuItem icon={<User className="w-4 h-4" />} onClick={onReturnToBot}>Вернуть боту</HeaderMenuItem>
                  ))}
                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                </div>
              )}
              {pinnedCount > 0 && (
                <HeaderMenuItem icon={<Pin className="w-4 h-4" />} onClick={onJumpToPinned}>Перейти к закреплённому</HeaderMenuItem>
              )}
              {pinnedCount > 1 && (
                <HeaderMenuItem icon={<PinOff className="w-4 h-4" />} onClick={onUnpinAll} danger>Открепить все ({pinnedCount})</HeaderMenuItem>
              )}
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              <HeaderMenuItem icon={<Trash2 className="w-4 h-4" />} onClick={onClearHistory} danger>Очистить историю</HeaderMenuItem>
              <HeaderMenuItem icon={<Ban className="w-4 h-4" />} onClick={onDeleteChat} danger>Удалить чат</HeaderMenuItem>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
