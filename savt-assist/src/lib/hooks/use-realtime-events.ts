'use client'

import { useEffect, useRef } from 'react'
import { eventsApi } from '@/lib/api/events'

export interface RealtimeEnvelope<T = unknown> {
  type: string
  chat_id?: number
  data: T
}

// Обёртка над Server-Sent Events канала /operator/events/* (см. README-backend.md,
// раздел "Realtime (SSE) для операторской панели"). Берёт на себя:
// - обмен Bearer-токена на одноразовый тикет перед каждым (пере)подключением —
//   EventSource не умеет слать заголовок Authorization, а нативный реконнект
//   браузера переиспользовал бы уже протухший/использованный тикет из URL, поэтому
//   на error мы сами закрываем поток и переподключаемся с новым тикетом;
// - подписку по именам SSE-событий (envelope.type), а не через onmessage —
//   сервер шлёт именованные события (`event: message.created`), которые
//   EventSource.onmessage не ловит.
//
// path — бэкенд-путь без префикса /backend (например '/operator/events/chats'
// или `/operator/events/chats/${chatId}`); null/undefined — не подключаться.
// onReconnect вызывается при восстановлении соединения после разрыва (не при
// самом первом подключении) — доставка SSE at-most-once, поэтому по факту
// реконнекта стоит один раз перезапросить актуальные данные через REST.
export function useRealtimeEvents(
  path: string | null | undefined,
  eventTypes: string[],
  onEvent: (envelope: RealtimeEnvelope) => void,
  onReconnect?: () => void
) {
  const onEventRef = useRef(onEvent)
  const onReconnectRef = useRef(onReconnect)
  useEffect(() => {
    onEventRef.current = onEvent
    onReconnectRef.current = onReconnect
  }, [onEvent, onReconnect])

  const eventTypesKey = eventTypes.join(',')

  useEffect(() => {
    if (!path) return

    let es: EventSource | null = null
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let everConnected = false

    async function connect() {
      if (cancelled) return
      try {
        const { ticket } = await eventsApi.getTicket()
        if (cancelled) return

        const sep = path!.includes('?') ? '&' : '?'
        es = new EventSource(`/backend${path}${sep}ticket=${encodeURIComponent(ticket)}`)

        es.onopen = () => {
          if (everConnected) onReconnectRef.current?.()
          everConnected = true
        }

        for (const type of eventTypesKey.split(',')) {
          if (!type) continue
          es.addEventListener(type, (e: MessageEvent) => {
            try {
              onEventRef.current(JSON.parse(e.data) as RealtimeEnvelope)
            } catch {}
          })
        }

        es.onerror = () => {
          es?.close()
          es = null
          if (!cancelled) retryTimer = setTimeout(connect, 3000)
        }
      } catch {
        if (!cancelled) retryTimer = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      cancelled = true
      es?.close()
      if (retryTimer) clearTimeout(retryTimer)
    }
    // eventTypesKey — стабильный примитив вместо массива eventTypes, чтобы не
    // требовать от вызывающего кода мемоизации инлайнового литерала
  }, [path, eventTypesKey])
}
