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
  getList: (params?: { is_read?: boolean; page?: number; size?: number }): Promise<NotifList> =>
    apiClient.get('/notifications', { params }).then(r => r.data),

  getUnreadCount: (): Promise<number> =>
    apiClient.get<NotifList>('/notifications', { params: { is_read: false, size: 1 } }).then(r => r.data.total),

  markRead: (id: number): Promise<void> =>
    apiClient.post(`/notifications/${id}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    apiClient.post('/notifications/read-all').then(() => undefined),
}
