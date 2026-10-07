'use client'

import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STAFF_SYNC_LISTS, type StaffSyncItem, type StaffSyncList, type StaffSyncReport } from '@/lib/api/users'
import { roleLabel } from './user-shared'

// Что это за список и как его читать: сначала то, что изменилось в системе
// (зелёный/нейтральный), потом деактивации, потом пропущенные — эти требуют
// действия в Bitrix (заполнить телефон, убрать дубль и т.д.).
const LIST_META: Record<StaffSyncList, { label: string; hint?: string; tone: 'ok' | 'info' | 'warn' | 'skip' }> = {
  created: { label: 'Заведены', tone: 'ok' },
  linked: { label: 'Привязаны к существующей учётке', hint: 'Номер совпал с уже заведённым вручную оператором или админом', tone: 'ok' },
  role_changed: { label: 'Сменилась роль', hint: 'Роль следует за отделом в Bitrix', tone: 'info' },
  reactivated: { label: 'Снова активны', tone: 'ok' },
  deactivated: { label: 'Деактивированы', hint: 'Сессии закрыты, учётка не удалена', tone: 'warn' },
  skipped_no_phone: { label: 'Пропущены: нет телефона', hint: 'Заполните телефон в карточке сотрудника в Bitrix', tone: 'skip' },
  skipped_invalid_phone: { label: 'Пропущены: телефон не распознан', hint: 'Нужен белорусский номер в обычном формате', tone: 'skip' },
  skipped_duplicate_phone: { label: 'Пропущены: один телефон у нескольких сотрудников', hint: 'Телефон должен быть уникальным', tone: 'skip' },
  skipped_conflict: { label: 'Пропущены: конфликт', hint: 'Номер уже привязан к другому сотруднику или логин занят', tone: 'skip' },
  skipped_no_password: { label: 'Пропущены: не задан начальный пароль', hint: 'Не заполнен BITRIX_STAFF_INITIAL_PASSWORD на сервере', tone: 'skip' },
}

const TONE_CLS = {
  ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  skip: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
} as const

function itemDetails(i: StaffSyncItem): string {
  return [i.role ? roleLabel(i.role) : null, i.login, i.phone, i.reason].filter(Boolean).join(' · ')
}

// Отчёт POST /admin/staff/bitrix-sync. Пустые списки не показываем; если
// изменений нет вообще — так и пишем, это нормальный исход.
export function StaffSyncReportDialog({ report, onClose }: { report: StaffSyncReport; onClose: () => void }) {
  const lists = STAFF_SYNC_LISTS
    .map(key => ({ key, items: report[key] ?? [], count: report.counts?.[key] ?? (report[key]?.length ?? 0) }))
    .filter(l => l.count > 0 || l.items.length > 0)

  const changed = lists.some(l => LIST_META[l.key].tone !== 'skip')

  return (
    <AppModal open onClose={onClose} className="sm:max-w-xl">
      <div className="flex flex-col max-h-[85vh] min-w-0">
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5 shrink-0">
          <div className="pr-8">
            <p className="font-bold text-lg text-white leading-tight">Синхронизация с Bitrix</p>
            <p className="text-sm text-white/70 mt-0.5">
              {lists.length === 0 ? 'Всё уже актуально' : changed ? 'Готово' : 'Изменений нет, есть пропущенные'}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          {lists.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Никого не завели, не привязали и не деактивировали: учётки сотрудников совпадают с Bitrix.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {lists.map(l => (
                  <span key={l.key} className={cn('px-2 py-1 rounded-lg text-xs font-medium', TONE_CLS[LIST_META[l.key].tone])}>
                    {LIST_META[l.key].label}: {l.count}
                  </span>
                ))}
              </div>

              {lists.map(l => (
                <section key={l.key}>
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {LIST_META[l.key].label} <span className="text-slate-400 font-normal">({l.count})</span>
                  </h4>
                  {LIST_META[l.key].hint && (
                    <p className="text-xs text-slate-400 mt-0.5">{LIST_META[l.key].hint}</p>
                  )}
                  {l.items.length > 0 && (
                    <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {l.items.map(i => (
                        <li key={i.bitrix_user_id} className="px-3 py-2 bg-white dark:bg-slate-800">
                          <p className="text-sm text-slate-700 dark:text-slate-200 wrap-break-word">{i.full_name}</p>
                          {itemDetails(i) && (
                            <p className="text-xs text-slate-400 mt-0.5 wrap-break-word">{itemDetails(i)}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">Закрыть</Button>
        </div>
      </div>
    </AppModal>
  )
}
