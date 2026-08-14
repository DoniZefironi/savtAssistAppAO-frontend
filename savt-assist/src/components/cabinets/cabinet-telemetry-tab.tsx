'use client'

import { TelemetryConsole } from '@/components/registers/telemetry-console'

// Лента аварий/сообщений с MQTT-контроллера. Отдельный от мобильного эндпоинт
// (без проверки членства в проекте) — оператор/админ, разбирающий аварию, не
// обязательно сам состоит в проекте этого ШУ (см. README-backend.md, «Рут
// admin: telemetry»).
export function TelemetryTab({ cabinetId }: { cabinetId: number }) {
  return (
    <div className="px-4 sm:px-6 py-4">
      <TelemetryConsole cabinetId={cabinetId} allowToggle initialIncludeUnnamed={false} />
    </div>
  )
}
