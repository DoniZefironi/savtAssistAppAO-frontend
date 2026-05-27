import { cn } from '@/lib/utils'
import { getWarrantyDaysLeft, getWarrantyStatus } from '@/lib/warranty'

interface Props {
  warrantyEndsAt: string | null
  warrantyStatus?: string | null
}

export function WarrantyBadge({ warrantyEndsAt, warrantyStatus: rawStatus }: Props) {
  const status = (rawStatus as ReturnType<typeof getWarrantyStatus>) ?? getWarrantyStatus(warrantyEndsAt)
  const days = getWarrantyDaysLeft(warrantyEndsAt)

  if (!status) return null

  const cfg = {
    active: {
      cls: 'bg-green-50 text-green-700 border-green-200',
      icon: '✓',
      label: days !== null ? `${days} дн.` : 'Активна',
    },
    expiring_soon: {
      cls: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: '⚠',
      label: days !== null ? `${days} дн.` : 'Истекает',
    },
    expired: {
      cls: 'bg-red-50 text-red-700 border-red-200',
      icon: '✕',
      label: 'Истекла',
    },
  }[status]

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border', cfg.cls)}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}
