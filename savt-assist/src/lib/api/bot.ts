import { apiClient } from './client'

export const botApi = {
  broadcastNotification: (data: { title: string; body: string; role: string | null }): Promise<void> =>
    apiClient.post('/admin/notifications/broadcast', data).then(() => undefined),
}
