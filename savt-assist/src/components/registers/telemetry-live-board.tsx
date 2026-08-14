'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { registersApi } from '@/lib/api/registers'
import { useRealtimeEvents } from '@/lib/hooks/use-realtime-events'
import { cn } from '@/lib/utils'
import type { TelemetryRegister } from '@/types'

const REFRESH_DEBOUNCE_MS = 400

function fmtTime(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function sortKey(r: TelemetryRegister) {
  return r.address * 100 + r.bit
}

// Текущее состояние карты регистров прямо сейчас — плоский список без
// пагинации (GET /admin/cabinets/{id}/telemetry, см. README-backend.md,
// «Рут admin: telemetry»). Намеренно без бегущей ленты истории — только
// текущее состояние.
export function TelemetryLiveBoard({ cabinetId, allowToggle = true, initialIncludeUnnamed = false, compact = false }: {
  cabinetId: number
  allowToggle?: boolean
  initialIncludeUnnamed?: boolean
  compact?: boolean
}) {
  const [includeUnnamed, setIncludeUnnamed] = useState(initialIncludeUnnamed)
  const qc = useQueryClient()
  const queryKey = ['cabinet-telemetry-live', cabinetId, includeUnnamed]
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => registersApi.getTelemetry(cabinetId, { include_unnamed: includeUnnamed }),
  })

  // Событие несёт только {cabinet_id, event_id}, не сами данные — по сигналу
  // просто перезапрашиваем снимок заново. Плоский список без пагинации —
  // обычный invalidate, тут нечего "проматывать". Дебаунс — несколько
  // событий подряд (пачка бит-переключений в одном сообщении с контроллера)
  // схлопываются в один запрос, а не по одному на каждое.
  const refresh = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => qc.invalidateQueries({ queryKey }), REFRESH_DEBOUNCE_MS)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  useRealtimeEvents(`/operator/events/cabinets/${cabinetId}/telemetry`, ['telemetry.created'], refresh, refresh)

  const registers = [...(data?.registers ?? [])].sort((a, b) => sortKey(a) - sortKey(b))

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/60 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          <span className="text-xs text-slate-500 font-mono ml-2">текущее состояние</span>
          <span className="flex items-center gap-1 ml-1" title="Обновляется в реальном времени">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-500/80 font-mono">live</span>
          </span>
        </div>
        {allowToggle && (
          <button
            onClick={() => setIncludeUnnamed(v => !v)}
            className={cn(
              'text-[11px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer',
              includeUnnamed
                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            )}
          >
            {includeUnnamed ? 'показаны все' : 'только названные'}
          </button>
        )}
      </div>

      <div className={cn('overflow-y-auto px-3 py-2 font-mono text-[13px] leading-relaxed', compact ? 'h-64' : 'min-h-[160px] max-h-[45vh]')}>
        {isLoading && <p className="text-slate-500">Загрузка…</p>}
        {isError && <p className="text-red-400">Не удалось загрузить телеметрию</p>}
        {!isLoading && !isError && registers.length === 0 && (
          <p className="text-slate-500">$ ожидание данных с контроллера…</p>
        )}
        <div className="divide-y divide-slate-900/80">
          {registers.map(r => <RegisterRow key={`${r.address}.${r.bit}`} r={r} />)}
        </div>
      </div>
    </div>
  )
}

function RegisterRow({ r }: { r: TelemetryRegister }) {
  const unknown = r.name === null
  const active = r.value === 1
  const label = unknown ? `Регистр ${r.address}.${r.bit}` : r.name

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span
        className={cn('truncate', unknown ? 'text-amber-400' : active ? 'text-emerald-300 font-semibold' : 'text-slate-400')}
        title={unknown ? 'Регистр не описан в карте — заведите под него запись' : undefined}
      >
        {label}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className={cn(
          'px-1.5 py-0.5 rounded text-[11px] font-semibold',
          active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-500'
        )}>
          {active ? '1' : '0'}
        </span>
        <span className="text-slate-600 text-[11px] w-28 text-right">{fmtTime(r.updated_at)}</span>
      </span>
    </div>
  )
}
