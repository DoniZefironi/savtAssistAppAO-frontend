export type WarrantyStatus = 'active' | 'expiring_soon' | 'expired'

export function getWarrantyStatus(endsAt: string | null): WarrantyStatus | null {
  if (!endsAt) return null
  const days = Math.floor((new Date(endsAt).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring_soon'
  return 'active'
}

export function getWarrantyDaysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null
  return Math.floor((new Date(endsAt).getTime() - Date.now()) / 86_400_000)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export function toIsoDate(date: Date): string {
  return date.toISOString()
}
