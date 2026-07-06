'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Package, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { chatsApi } from '@/lib/api/chats'
import { useAuthStore } from '@/lib/store/auth'
import { useChatNavStore } from '@/lib/store/chat-nav'

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function chatLabel(item: { chat_type: string; cabinet_object_number: string | null; sender_name: string }) {
  if (item.chat_type === 'cabinet' && item.cabinet_object_number) return `ШУ ${item.cabinet_object_number}`
  return item.sender_name
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const setPendingChatId = useChatNavStore((s) => s.setPendingChatId)

  useEffect(() => {
    const t = setTimeout(() => setQuery(input.trim()), 350)
    return () => clearTimeout(t)
  }, [input])

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => chatsApi.searchAllMessages(query, 1, 20),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })

  const results = data?.items ?? []

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setInput(''); setQuery('') }
  }, [open])

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  const handleSelect = (chatId: number) => {
    setOpen(false)
    const chatsPath = user?.role === 'admin' ? '/admin/chats' : '/operator/chats'
    setPendingChatId(chatId)
    if (pathname === chatsPath) {
      // already on chats — store will trigger auto-select
    } else {
      router.push(chatsPath)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title="Поиск по сообщениям"
        className={cn(
          'relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer',
          open
            ? 'bg-[#1B3A72] text-white'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
        )}
      >
        <SearchIcon className="w-4.5 h-4.5" />
      </button>

      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed w-[420px] bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col"
          style={{ top: dropPos.top, right: dropPos.right, zIndex: 9999, maxHeight: 480 }}
        >
          <div className="px-4 pt-3 pb-2 shrink-0">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Поиск по всем сообщениям..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#4A8FE7]"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700" />

          <div className="flex-1 overflow-y-auto">
            {query.length < 2 ? (
              <div className="py-10 flex flex-col items-center gap-1 text-slate-400">
                <SearchIcon className="w-8 h-8 opacity-30" />
                <p className="text-sm mt-1">Введите минимум 2 символа</p>
              </div>
            ) : isLoading ? (
              <div className="py-8 flex justify-center">
                <SpinnerIcon className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-1 text-slate-400">
                <p className="text-sm">Ничего не найдено</p>
              </div>
            ) : (
              <ul>
                {results.map(item => (
                  <li key={item.id}>
                    <button
                      onClick={() => handleSelect(item.chat_id)}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1B3A72]/10 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5 text-[#1B3A72] dark:text-blue-400">
                        {item.chat_type === 'cabinet' ? <Package className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-[#1B3A72] dark:text-blue-400 truncate">
                            {chatLabel(item)}
                          </span>
                          <span className="text-[11px] text-slate-400 shrink-0">{fmtTime(item.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 truncate">{item.sender_name}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">{item.text}</p>
                      </div>
                    </button>
                  </li>
                ))}
                {(data?.total ?? 0) > results.length && (
                  <li className="px-4 py-2 text-center">
                    <p className="text-xs text-slate-400">Показано {results.length} из {data?.total}. Уточните запрос.</p>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
}

function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
