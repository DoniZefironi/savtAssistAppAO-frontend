import { apiClient } from './client'

export interface ReindexResult {
  status: string
  indexed: {
    faq: number
    kb_article: number
    document: number
  }
}

export const botApi = {
  reindex: (): Promise<ReindexResult> =>
    apiClient.post('/admin/bot/reindex').then(r => r.data),

  broadcastNotification: (data: { title: string; body: string; role: string | null }): Promise<void> =>
    apiClient.post('/admin/notifications/broadcast', data).then(() => undefined),
}
