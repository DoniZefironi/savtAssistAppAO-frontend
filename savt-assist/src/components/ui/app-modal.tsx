'use client'

import * as React from 'react'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function AppModal({ open, onClose, children, className }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn('sm:max-w-lg p-0 overflow-hidden gap-0', className)}
      >
        {children}
        <DialogClose className="absolute top-3 right-3 z-10 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
