import { apiClient } from './client'

// Заготовка рекламного сообщения — теперь CRUD-сущность на бэкенде (была
// файлом), id соответственно числовой, не строковый (app/routers/notifications.py).
export interface PromoMessage {
  id: number
  title: string
  body: string
  data: Record<string, string>
  created_at: string
  updated_at: string
}

// sent_to — кому реально ушли и запись в историю, и пуш.
// skipped_opted_out — кого пропустили из-за выключенного promotional.
export interface BroadcastResult {
  sent_to: number
  skipped_opted_out: number
}

// promo/send возвращает то же плюс саму разосланную заготовку
export interface PromoSendResult extends BroadcastResult {
  message: PromoMessage
}

// Ответ reindex — только статус запуска, итоговая статистика (сколько
// проиндексировано/пропущено) видна лишь в логах api, не в HTTP-ответе
// (см. README-backend.md, «Рут admin: bot»).
export interface ReindexResult {
  status: string
  message: string
}

export interface PruneResult {
  status: string
  removed: { faq: number; kb_article: number; document: number }
}

// Настройки автоматической рассылки рекламных заготовок. send_hour — час по
// UTC (0-23), фронт сам переводит в/из локального времени для отображения.
// message_ids: null/[] — случайная заготовка из всех; список id — случайная
// среди них; один id в списке — всегда именно она.
export interface PromoSchedule {
  enabled: boolean
  interval_days: number
  send_hour: number
  message_ids: number[] | null
  last_sent_at: string | null
}

export const botApi = {
  broadcastNotification: (data: { title: string; body: string; role: string | null }): Promise<BroadcastResult> =>
    apiClient.post('/admin/notifications/broadcast', data).then(r => r.data),

  getPromoMessages: (): Promise<PromoMessage[]> =>
    apiClient.get('/admin/notifications/promo/messages').then(r => r.data),

  createPromoMessage: (data: { title: string; body: string }): Promise<PromoMessage> =>
    apiClient.post('/admin/notifications/promo/messages', data).then(r => r.data),

  // Частичное обновление — шлём только реально изменённые поля.
  updatePromoMessage: (id: number, patch: Partial<{ title: string; body: string }>): Promise<PromoMessage> =>
    apiClient.patch(`/admin/notifications/promo/messages/${id}`, patch).then(r => r.data),

  deletePromoMessage: (id: number): Promise<void> =>
    apiClient.delete(`/admin/notifications/promo/messages/${id}`).then(() => undefined),

  // promo_id пуст — сервер возьмёт случайную заготовку.
  // В README параметры описаны без примера тела, поэтому шлём их строкой запроса.
  sendPromo: (promoId: number | null, role: string | null): Promise<PromoSendResult> =>
    apiClient.post('/admin/notifications/promo/send', null, {
      params: { ...(promoId != null ? { promo_id: promoId } : {}), ...(role ? { role } : {}) },
    }).then(r => r.data),

  // 202 сразу, сам подсчёт идёт в фоне — на восстановление из бэкапа/ручные
  // правки в БД или если фоновая автоиндексация когда-то не отработала.
  // scope сужает переиндексацию до одного источника; project_id имеет эффект
  // только при scope='document' — фильтрует документы этого проекта (и его
  // дочерних проектов, и всех ШУ внутри них), т.е. ровно то, что видит бот
  // в чате проекта.
  reindex: (params: {
    force: boolean
    scope?: 'all' | 'faq' | 'kb_article' | 'document'
    project_id?: number | null
  }): Promise<ReindexResult> =>
    apiClient.post('/admin/bot/reindex', null, {
      params: {
        force: params.force,
        scope: params.scope ?? 'all',
        ...(params.project_id != null ? { project_id: params.project_id } : {}),
      },
    }).then(r => r.data),

  // Чистит embeddings-сироты (источник — FAQ/статья КБ/документ — уже удалён).
  prune: (): Promise<PruneResult> =>
    apiClient.post('/admin/bot/prune').then(r => r.data),

  getPromoSchedule: (): Promise<PromoSchedule> =>
    apiClient.get('/admin/notifications/promo/schedule').then(r => r.data),

  // Частичное обновление — шлём только реально изменённые поля. Чтобы явно
  // сбросить ограничение по заготовкам обратно на "любая из всех", ключ
  // message_ids должен быть в теле со значением null (а не просто отсутствовать).
  updatePromoSchedule: (patch: Partial<{
    enabled: boolean
    interval_days: number
    send_hour: number
    message_ids: number[] | null
  }>): Promise<PromoSchedule> =>
    apiClient.patch('/admin/notifications/promo/schedule', patch).then(r => r.data),
}
