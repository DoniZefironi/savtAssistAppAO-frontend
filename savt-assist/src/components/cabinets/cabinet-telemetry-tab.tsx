'use client'

import { TelemetryLiveBoard } from '@/components/registers/telemetry-live-board'

// Текущее состояние карты регистров прямо сейчас — плоский снимок без
// пагинации (GET /admin/cabinets/{id}/telemetry, см. README-backend.md,
// «Рут admin: telemetry»). История сырых событий (.../telemetry/history)
// сюда намеренно не выводится — только текущее состояние, без бегущей ленты.
// Отдельный от мобильного эндпоинт (без проверки членства в проекте) —
// оператор/админ, разбирающий аварию, не обязательно сам состоит в проекте
// этого ШУ.
export function TelemetryTab({ cabinetId }: { cabinetId: number }) {
  return (
    <div className="px-4 sm:px-6 py-4">
      <TelemetryLiveBoard cabinetId={cabinetId} allowToggle initialIncludeUnnamed={false} />
    </div>
  )
}
