'use client'

import { useState } from 'react'
import { Building2, Truck, ShieldCheck, ChevronDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/warranty'
import type { ProjectDetail, WarrantyStatus } from '@/types'

// Блок «из сделки Bitrix» в карточке проекта. Всё только для чтения: поля
// перезаписываются на каждом изменении сделки, PATCH их не принимает — рисовать
// редактирование значило бы обещать то, чего нет (см. README-backend.md,
// «Поля сделки в карточке проекта»). Гарантия — исключение, она редактируется
// в самой форме проекта, здесь показывается только результат.
export function ProjectDealInfo({ project }: { project: ProjectDetail }) {
  const [contactsOpen, setContactsOpen] = useState(false)
  const contacts = project.contacts ?? []

  const hasDeal = !!(project.production_number || project.company_name
    || project.shipment_planned_at || project.shipment_actual_at)
  const hasWarranty = !!(project.warranty_starts_at || project.warranty_ends_at)

  if (!hasDeal && !hasWarranty && contacts.length === 0) return null

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
      {project.production_number && (
        <span className="font-medium text-slate-600 dark:text-slate-300">
          № {project.production_number}
        </span>
      )}

      {project.company_name && (
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          {project.company_name}
        </span>
      )}

      {/* Пока фактической отгрузки нет — показываем плановую как ожидаемую */}
      {(project.shipment_actual_at || project.shipment_planned_at) && (
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <Truck className="w-3.5 h-3.5 shrink-0" />
          {project.shipment_actual_at
            ? `отгружен ${formatDate(project.shipment_actual_at)}`
            : `отгрузка план. ${formatDate(project.shipment_planned_at)}`}
        </span>
      )}

      {hasWarranty && (
        <span className="flex items-center gap-1">
          <ShieldCheck className={cn('w-3.5 h-3.5 shrink-0', warrantyCls(project.warranty_status))} />
          <span className={warrantyCls(project.warranty_status)}>
            {warrantyLabel(project.warranty_status)}
          </span>
          <span className="text-slate-400">
            {formatDate(project.warranty_starts_at)} — {formatDate(project.warranty_ends_at)}
          </span>
        </span>
      )}

      {contacts.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setContactsOpen(v => !v)}
            className="flex items-center gap-1 text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            Контакты ({contacts.length})
            <ChevronDown className={cn('w-3 h-3 transition-transform', contactsOpen && 'rotate-180')} />
          </button>

          {contactsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setContactsOpen(false)} />
              <div className="absolute z-20 mt-1 left-0 w-80 max-w-[90vw] max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-700">
                {contacts.map(c => (
                  <div key={c.id} className="px-3 py-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{c.full_name}</p>
                    {c.post && <p className="text-[11px] text-slate-400 mt-0.5">{c.post}</p>}
                    {c.phones.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        {c.phones.map(p => (
                          <a key={p} href={`tel:${p}`} className="text-[11px] text-[#1B3A72] dark:text-blue-400 hover:underline">{p}</a>
                        ))}
                      </div>
                    )}
                    {c.emails.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        {c.emails.map(e => (
                          <a key={e} href={`mailto:${e}`} className="text-[11px] text-slate-500 dark:text-slate-400 hover:underline break-all">{e}</a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <p className="px-3 py-1.5 text-[10px] text-slate-400 sticky bottom-0 bg-white dark:bg-slate-800">
                  Из сделки Bitrix, только для чтения
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function warrantyCls(s: WarrantyStatus | null | undefined): string {
  if (s === 'active') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'expiring_soon') return 'text-amber-600 dark:text-amber-400'
  if (s === 'expired') return 'text-rose-500 dark:text-rose-400'
  return 'text-slate-400'
}

function warrantyLabel(s: WarrantyStatus | null | undefined): string {
  if (s === 'active') return 'Гарантия'
  if (s === 'expiring_soon') return 'Гарантия истекает'
  if (s === 'expired') return 'Гарантия истекла'
  return 'Гарантия не задана'
}
