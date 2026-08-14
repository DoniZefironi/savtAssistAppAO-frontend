'use client'

import { TelemetryLiveBoard } from '@/components/registers/telemetry-live-board'
import { TelemetryHistoryConsole } from '@/components/registers/telemetry-console'

// Текущее состояние карты регистров (снимок без пагинации) + история сырых
// событий (для разбора аварии постфактум) — оба отдельные эндпоинты, см.
// README-backend.md, «Рут admin: telemetry». Отдельный от мобильного
// (без проверки членства в проекте) — оператор/админ, разбирающий аварию, не
// обязательно сам состоит в проекте этого ШУ.
export function TelemetryTab({ cabinetId }: { cabinetId: number }) {
  return (
    <div className="px-4 sm:px-6 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Текущее состояние</h3>
        <TelemetryLiveBoard cabinetId={cabinetId} allowToggle initialIncludeUnnamed={false} />
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">История событий</h3>
        <TelemetryHistoryConsole cabinetId={cabinetId} allowToggle initialIncludeUnnamed={false} />
      </div>
    </div>
  )
}
