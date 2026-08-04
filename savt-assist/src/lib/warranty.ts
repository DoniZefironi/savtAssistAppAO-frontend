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

// Отгрузка проекта одной строкой. Порядок важен: факт вытесняет план, а когда
// нет ни того ни другого — это не «пусто», а осмысленное «ещё не запланирована»,
// иначе непонятно, то ли даты нет, то ли её не подтянули из сделки.
export function shipmentLabel(
  plannedAt: string | null | undefined,
  actualAt: string | null | undefined,
): { text: string; state: 'shipped' | 'planned' | 'unplanned' } {
  if (actualAt) return { text: `Отгружен ${formatDate(actualAt)}`, state: 'shipped' }
  if (plannedAt) return { text: `Отгрузка ${formatDate(plannedAt)}`, state: 'planned' }
  return { text: 'Отгрузка не запланирована', state: 'unplanned' }
}
