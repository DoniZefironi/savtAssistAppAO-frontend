import { apiClient } from './client'

// Заготовка рекламного сообщения из подборки на сервере
// (app/data/promo_messages.json либо файл из PROMO_MESSAGES_FILE)
export interface PromoMessage {
  id: string
  title: string
  body: string
  data: Record<string, string>
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

export const botApi = {
  broadcastNotification: (data: { title: string; body: string; role: string | null }): Promise<BroadcastResult> =>
    apiClient.post('/admin/notifications/broadcast', data).then(r => r.data),

  getPromoMessages: (): Promise<PromoMessage[]> =>
    apiClient.get('/admin/notifications/promo').then(r => r.data),

  // promo_id пуст — сервер возьмёт случайную заготовку.
  // В README параметры описаны без примера тела, поэтому шлём их строкой запроса.
  sendPromo: (promoId: string | null, role: string | null): Promise<PromoSendResult> =>
    apiClient.post('/admin/notifications/promo/send', null, {
      params: { ...(promoId ? { promo_id: promoId } : {}), ...(role ? { role } : {}) },
    }).then(r => r.data),

  // 202 сразу, сам подсчёт идёт в фоне — на восстановление из бэкапа/ручные
  // правки в БД или если фоновая автоиндексация когда-то не отработала.
  reindex: (force: boolean): Promise<ReindexResult> =>
    apiClient.post('/admin/bot/reindex', null, { params: { force } }).then(r => r.data),

  // Чистит embeddings-сироты (источник — FAQ/статья КБ/документ — уже удалён).
  prune: (): Promise<PruneResult> =>
    apiClient.post('/admin/bot/prune').then(r => r.data),
}
