'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { registersApi } from '@/lib/api/registers'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import type { TelemetryRegister } from '@/types'

const PAGE_SIZE = 20

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Лента аварий/сообщений с MQTT-контроллера. Отдельный от мобильного эндпоинт
// (без проверки членства в проекте) — оператор/админ, разбирающий аварию, не
// обязательно сам состоит в проекте этого ШУ (см. README-backend.md, «Рут
// admin: telemetry»).
export function TelemetryTab({ cabinetId }: { cabinetId: number }) {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinet-telemetry', cabinetId, page],
    queryFn: () => registersApi.getTelemetry(cabinetId, { page, size: PAGE_SIZE }),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 px-6 py-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    )
  }

  const items = data?.items ?? []

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <p className="text-sm">Пока нет данных с контроллера</p>
      </div>
    )
  }

  // Определённые (name !== null) bit-регистры показываем только когда они
  // реально сработали (active === true) — остальные заведомые, но неактивные
  // биты были бы шумом на каждое сообщение. Обычные значения (bit === null)
  // и неописанные регистры (name === null, сигнал дозаполнить карту) видны всегда.
  const visibleRegisters = (registers: TelemetryRegister[]) =>
    registers.filter(r => r.name === null || r.bit === null || r.active === true)

  const visibleEntries = items
    .map(entry => ({ entry, registers: visibleRegisters(entry.registers) }))
    .filter(({ registers }) => registers.length > 0)

  return (
    <div className="flex flex-col">
      {visibleEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <p className="text-sm">На этой странице нет значимых событий</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
          {visibleEntries.map(({ entry, registers }) => (
            <div key={entry.id} className="px-4 sm:px-6 py-3">
              <p className="text-xs text-slate-400 mb-1.5">{fmtDateTime(entry.received_at)}</p>
              <div className="flex flex-wrap gap-1.5">
                {registers.map((r, i) => <RegisterChip key={i} r={r} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {data && (
        <Pagination page={data.page} pages={data.pages} onPage={setPage} />
      )}
    </div>
  )
}

function RegisterChip({ r }: { r: TelemetryRegister }) {
  const unknown = r.name === null
  // Сработавшая авария битовой маски — сырое value регистра тут не нужно
  // (см. README-backend.md), важен сам факт срабатывания.
  const isAlarm = !unknown && r.bit !== null

  if (unknown) {
    const label = r.bit !== null ? `Регистр ${r.address}.${r.bit}` : `Регистр ${r.address}`
    return (
      <span
        title="Регистр не описан в карте — заведите под него запись"
        className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium"
      >
        {label}: {r.value}
      </span>
    )
  }

  if (isAlarm) {
    return (
      <span
        title={`Адрес ${r.address}, бит ${r.bit}`}
        className="inline-flex items-center px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium"
      >
        {r.name}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium">
      {r.name}: {r.value}
    </span>
  )
}
