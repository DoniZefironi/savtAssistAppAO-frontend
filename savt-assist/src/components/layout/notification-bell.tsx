'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { notificationsApi } from '@/lib/api/notifications'
import type { NotifType } from '@/lib/api/notifications'

type Tab = 'unread' | 'read'

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('unread')
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: unreadData, isLoading: unreadLoading } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.getList({ is_read: false, size: 50 }),
    refetchInterval: 10_000,
  })

  const { data: readData, isLoading: readLoading } = useQuery({
    queryKey: ['notifications', 'read'],
    queryFn: () => notificationsApi.getList({ is_read: true, size: 50 }),
    enabled: open && tab === 'read',
    staleTime: 30_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] })

  const markReadMut = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: invalidate,
  })

  const markAllMut = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: invalidate,
  })

  const clearAllMut = useMutation({
    mutationFn: notificationsApi.clearAll,
    onSuccess: invalidate,
  })

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

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
      setTab('unread')
    }
    setOpen(v => !v)
  }

  const unreadItems = unreadData?.items ?? []
  const readItems = readData?.items ?? []
  const unreadCount = unreadData?.total ?? unreadItems.length
  const hasUnread = unreadCount > 0

  const currentItems = tab === 'unread' ? unreadItems : readItems
  const currentLoading = tab === 'unread' ? unreadLoading : readLoading

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        title="Уведомления"
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <BellIcon className="w-4.5 h-4.5" />
        {hasUnread && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>

      {open && dropPos && createPortal(
        <div
          ref={dropRef}
          className="fixed w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden"
          style={{ top: dropPos.top, right: dropPos.right, zIndex: 9999 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Уведомления</span>
            <div className="flex items-center gap-3">
              {currentItems.length > 0 && (
                <button
                  onClick={() => clearAllMut.mutate()}
                  disabled={clearAllMut.isPending}
                  className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Очистить всё
                </button>
              )}
              {tab === 'unread' && hasUnread && (
                <button
                  onClick={() => markAllMut.mutate()}
                  disabled={markAllMut.isPending}
                  className="text-xs text-[#4A8FE7] hover:text-[#1B3A72] dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Прочитать все
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-2 pb-0">
            <button
              onClick={() => setTab('unread')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-colors cursor-pointer',
                tab === 'unread'
                  ? 'border-[#4A8FE7] text-[#1B3A72] dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              )}
            >
              Новые
              {hasUnread && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('read')}
              className={cn(
                'px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-colors cursor-pointer',
                tab === 'read'
                  ? 'border-[#4A8FE7] text-[#1B3A72] dark:text-blue-300 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              )}
            >
              Прочитанные
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700" />

          {/* List */}
          <div className="max-h-105 overflow-y-auto">
            {currentLoading ? (
              <div className="py-8 flex justify-center">
                <SpinnerIcon className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : currentItems.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
                <BellOffIcon className="w-8 h-8" />
                <p className="text-sm">{tab === 'unread' ? 'Нет новых уведомлений' : 'Нет прочитанных уведомлений'}</p>
              </div>
            ) : (
              <ul>
                {currentItems.map(n => (
                  <li key={n.id}>
                    <button
                      onClick={() => { if (!n.is_read) markReadMut.mutate(n.id) }}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                        tab === 'unread'
                          ? 'bg-blue-50/60 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-default'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                        typeColor(n.type)
                      )}>
                        <NotifIcon type={n.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            'text-sm leading-tight',
                            tab === 'unread'
                              ? 'font-semibold text-slate-800 dark:text-slate-100'
                              : 'text-slate-500 dark:text-slate-400'
                          )}>
                            {n.title}
                          </p>
                          {tab === 'unread' && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>
                        <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">{relativeTime(n.created_at)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function typeColor(type: NotifType): string {
  switch (type) {
    case 'operator_requested': return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    case 'chat_message':       return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    case 'warranty_expiring':  return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
    case 'promotional':        return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
    case 'request_status':     return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    default:                   return 'bg-slate-100 dark:bg-slate-700 text-slate-500'
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'только что'
  if (mins < 60) return `${mins} мин. назад`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs} ч. назад`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'вчера'
  if (days < 7)  return `${days} дн. назад`
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

function NotifIcon({ type }: { type: NotifType }) {
  const cls = 'w-4 h-4'
  switch (type) {
    case 'operator_requested':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
    case 'chat_message':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
    case 'warranty_expiring':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
    case 'promotional':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
    case 'request_status':
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
    default:
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
  }
}

function BellIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
}

function BellOffIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.3-5.542m3.155 6.852a3 3 0 005.667 1.069m1.55-1.069a24.248 24.248 0 003.503-.342m-7.153 1.41A8.967 8.967 0 0018 9.75v-.7M9.143 17.082L5.636 5.636m0 0A8.955 8.955 0 0112 3c.898 0 1.766.124 2.584.357m4.78 4.78a8.955 8.955 0 01.777 4.363v.7a8.964 8.964 0 01-2.3 5.542m0 0L5.636 5.636m0 0L3 3" /></svg>
}

function SpinnerIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
}
