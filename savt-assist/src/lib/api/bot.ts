import { apiClient } from './client'

export interface ReindexResult {
  status: string
  indexed: {
    faq: number
    kb_article: number
    document: number
    skipped: number
  }
}

export const botApi = {
  reindex: (force = false): Promise<ReindexResult> =>
    apiClient.post('/admin/bot/reindex', null, { params: force ? { force: true } : {} }).then(r => r.data),

  broadcastNotification: (data: { title: string; body: string; role: string | null }): Promise<void> =>
    apiClient.post('/admin/notifications/broadcast', data).then(() => undefined),
}
