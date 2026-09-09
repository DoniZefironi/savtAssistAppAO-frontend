'use client'

import { cn } from '@/lib/utils'

interface Props {
  icon: React.ReactNode
  title: string
  subtitle: string
  badge?: React.ReactNode
  // Синий по умолчанию (как у диалогов заявок); create-модалки передают
  // свой градиент (фиолетовый — админ, зелёный — пользователь и т.п.)
  gradient?: string
}

// Градиентная шапка модалки — раньше руками повторялась в каждом create-диалоге
// (см. request-shared.tsx до выноса — там же остальные общие куски диалогов).
export function DialogHeader({ icon, title, subtitle, badge, gradient = 'from-[#4A8FE7] to-[#1B3A72]' }: Props) {
  return (
    <div className={cn('bg-linear-to-r px-4 sm:px-6 py-4 sm:py-5 shrink-0', gradient)}>
      <div className="flex items-start gap-3 sm:gap-4 pr-8">
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-lg text-white leading-tight">{title}</p>
          <p className="text-sm text-white/60 mt-0.5">{subtitle}</p>
          {badge && <div className="mt-2">{badge}</div>}
        </div>
      </div>
    </div>
  )
}
