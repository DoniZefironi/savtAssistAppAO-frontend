import { apiClient } from './client'

export type NotifType = 'warranty_expiring' | 'promotional' | 'chat_message' | 'operator_requested' | 'request_status'

export interface Notification {
  id: number
  type: NotifType
  title: string
  body: string
  data: Record<string, unknown>
  is_read: boolean
  created_at: string
}

interface NotifList {
  items: Notification[]
  total: number
  page: number
  size: number
  pages: number
}

export const notificationsApi = {
  // type — повторяемый параметр: ?type=request_status&type=warranty_expiring.
  // Сообщений чатов в истории нет, они push-only (у чатов свои счётчики).
  getList: (params?: { is_read?: boolean; type?: NotifType[]; page?: number; size?: number }): Promise<NotifList> =>
    apiClient.get('/notifications', { params }).then(r => r.data),

  // Отдельная ручка под бейдж — дешевле, чем тянуть страницу списка ради одного числа
  getUnreadCount: (): Promise<number> =>
    apiClient.get<{ unread: number }>('/notifications/unread-count').then(r => r.data.unread),

  markRead: (id: number): Promise<void> =>
    apiClient.post(`/notifications/${id}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    apiClient.post('/notifications/read-all').then(() => undefined),

  clearAll: (): Promise<void> =>
    apiClient.delete('/notifications').then(() => undefined),
}
