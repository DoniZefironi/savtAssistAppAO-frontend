'use client'

import { useEffect, useRef, useState } from 'react'
import { useRealtimeEvents } from '@/lib/hooks/use-realtime-events'
import { TelemetryLiveBoard } from '@/components/registers/telemetry-live-board'
import { TelemetryHistoryConsole } from '@/components/registers/telemetry-console'

const BUMP_DEBOUNCE_MS = 400

// Текущее состояние карты регистров (снимок без пагинации) + история сырых
// событий (для разбора аварии постфактум) — оба отдельные эндпоинты, см.
// README-backend.md, «Рут admin: telemetry». Отдельный от мобильного
// (без проверки членства в проекте) — оператор/админ, разбирающий аварию, не
// обязательно сам состоит в проекте этого ШУ.
//
// Подписка на SSE-канал этого ШУ — одна на обе секции ниже, а не по одной на
// компонент: если бы TelemetryLiveBoard и TelemetryHistoryConsole сами
// открывали EventSource на один и тот же /operator/events/cabinets/{id}/telemetry,
// каждое реальное событие удваивалось бы (два подключения — два колбэка),
// что и раскручивало цикл частых resetQueries/invalidateQueries на бэкенде.
export function TelemetryTab({ cabinetId }: { cabinetId: number }) {
  const [realtimeSignal, setRealtimeSignal] = useState(0)
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bump = () => {
    if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current)
    bumpTimerRef.current = setTimeout(() => setRealtimeSignal(v => v + 1), BUMP_DEBOUNCE_MS)
  }

  useRealtimeEvents(`/operator/events/cabinets/${cabinetId}/telemetry`, ['telemetry.created'], bump, bump)
  useEffect(() => () => { if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current) }, [])

  return (
    <div className="px-4 sm:px-6 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Текущее состояние</h3>
        <TelemetryLiveBoard cabinetId={cabinetId} allowToggle initialIncludeUnnamed={false} realtimeSignal={realtimeSignal} />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">История событий</h3>
        <TelemetryHistoryConsole cabinetId={cabinetId} allowToggle initialIncludeUnnamed={false} realtimeSignal={realtimeSignal} />
      </div>
    </div>
  )
}
