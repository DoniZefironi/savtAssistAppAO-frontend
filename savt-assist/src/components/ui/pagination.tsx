'use client'

import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  pages: number
  onPage: (p: number) => void
}

export function Pagination({ page, pages, onPage }: PaginationProps) {
  if (pages <= 1) return null

  const nums = buildPageNums(page, pages)

  return (
    <div className="flex items-center justify-center gap-1 py-3 border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-900 shrink-0">
      <PBtn onClick={() => onPage(page - 1)} disabled={page <= 1}>‹</PBtn>
      {nums.map((n, i) =>
        n === '...' ? (
          <span key={`d${i}`} className="w-8 text-center text-slate-400 text-sm select-none">…</span>
        ) : (
          <PBtn key={n} onClick={() => onPage(n as number)} active={n === page}>{n}</PBtn>
        )
      )}
      <PBtn onClick={() => onPage(page + 1)} disabled={page >= pages}>›</PBtn>
    </div>
  )
}

function PBtn({ onClick, disabled, active, children }: {
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-[#1B3A72] text-white'
          : disabled
          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'
      )}
    >
      {children}
    </button>
  )
}

function buildPageNums(page: number, pages: number): (number | '...')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const r: (number | '...')[] = [1]
  if (page > 3) r.push('...')
  for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) r.push(i)
  if (page < pages - 2) r.push('...')
  r.push(pages)
  return r
}
