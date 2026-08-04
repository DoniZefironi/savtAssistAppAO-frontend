'use client'

import { useState } from 'react'
import { Building2, Truck, ShieldCheck, ChevronDown, Users, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate, shipmentLabel } from '@/lib/warranty'
import type { ProjectDetail, WarrantyStatus } from '@/types'

// Блок «из сделки Bitrix» в карточке проекта. Всё только для чтения: поля
// перезаписываются на каждом изменении сделки, PATCH их не принимает — рисовать
// редактирование значило бы обещать то, чего нет (см. README-backend.md,
// «Поля сделки в карточке проекта»). Гарантия — исключение, она редактируется
// в самой форме проекта, здесь показывается только результат.
//
// Раскладка — сетка «подпись сверху, значение снизу», а не сплошной ряд
// надписей: полей стало много, и вперемешку они читались как одна строка.
export function ProjectDealInfo({ project }: { project: ProjectDetail }) {
  const [contactsOpen, setContactsOpen] = useState(false)
  const contacts = project.contacts ?? []

  const hasDeal = !!(project.production_number || project.company_name
    || project.shipment_planned_at || project.shipment_actual_at)
  const hasWarranty = !!(project.warranty_starts_at || project.warranty_ends_at)

  if (!hasDeal && !hasWarranty && contacts.length === 0) return null

  const shipment = shipmentLabel(project.shipment_planned_at, project.shipment_actual_at)

  return (
    <div className="mb-3 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-2.5">
        {project.production_number && (
          <Field icon={Hash} label="Номер в производство">
            <span className="font-medium text-slate-700 dark:text-slate-200">{project.production_number}</span>
          </Field>
        )}

        {project.company_name && (
          <Field icon={Building2} label="Заказчик">
            <span className="text-slate-700 dark:text-slate-200 wrap-break-word">{project.company_name}</span>
          </Field>
        )}

        <Field icon={Truck} label="Отгрузка">
          <span className={cn(
            shipment.state === 'shipped' ? 'text-emerald-600 dark:text-emerald-400'
              : shipment.state === 'planned' ? 'text-slate-700 dark:text-slate-200'
              : 'text-slate-400 italic'
          )}>
            {shipment.text}
          </span>
          {/* Уже отгружен — плановая дата всё ещё полезна: видно, попали ли в срок */}
          {shipment.state === 'shipped' && project.shipment_planned_at && (
            <span className="block text-[11px] text-slate-400 mt-0.5">
              план был {formatDate(project.shipment_planned_at)}
            </span>
          )}
        </Field>

        <Field icon={ShieldCheck} label="Гарантия">
          {hasWarranty ? (
            <>
              <span className={warrantyCls(project.warranty_status)}>
                {warrantyLabel(project.warranty_status)}
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {formatDate(project.warranty_starts_at)} — {formatDate(project.warranty_ends_at)}
              </span>
            </>
          ) : (
            <span className="text-slate-400 italic">Не задана</span>
          )}
        </Field>

        {contacts.length > 0 && (
          <Field icon={Users} label="Контактные лица">
            <div className="relative">
              <button
                onClick={() => setContactsOpen(v => !v)}
                className="flex items-center gap-1 text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer"
              >
                {contacts.length === 1 ? contacts[0].full_name : `${contacts.length} чел.`}
                <ChevronDown className={cn('w-3 h-3 transition-transform', contactsOpen && 'rotate-180')} />
              </button>

              {contactsOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setContactsOpen(false)} />
                  <div className="absolute z-20 mt-1 left-0 w-80 max-w-[85vw] max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-700">
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
          </Field>
        )}

      </div>
    </div>
  )
}

function Field({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">
        <Icon className="w-3 h-3 shrink-0" />
        {label}
      </p>
      <div className="text-xs">{children}</div>
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
  if (s === 'active') return 'Действует'
  if (s === 'expiring_soon') return 'Истекает'
  if (s === 'expired') return 'Истекла'
  return 'Не задана'
}
