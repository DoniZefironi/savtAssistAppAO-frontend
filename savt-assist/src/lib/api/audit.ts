import { apiClient } from './client'
import type { PaginatedResponse } from '@/types'

// Ответ GET /admin/audit-logs не задокументирован примером JSON в README-backend.md —
// форма ответа собрана по перечисленным параметрам фильтрации/сортировки
// (actor_id/actor_role/actor_name, action, entity_type/entity_id, payload, created_at).
// Стоит свериться с реальным ответом сервера при первом использовании.
export interface AuditLog {
  id: number
  actor_id: number | null
  actor_role: 'admin' | 'operator' | 'user' | 'system'
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: number | null
  payload: Record<string, unknown> | null
  created_at: string
}

export interface AuditLogsParams {
  actor_id?: number
  actor_role?: 'admin' | 'operator' | 'user' | 'system'
  action?: string
  entity_type?: string
  entity_id?: number
  date_from?: string
  date_to?: string
  search?: string
  search_in?: 'all' | 'action' | 'entity_type' | 'actor_name' | 'payload'
  sort_by?: 'created_at' | 'action' | 'entity_type' | 'actor_role' | 'actor_id'
  sort_order?: 'asc' | 'desc'
  page?: number
  size?: number
}

export const auditApi = {
  getLogs: async (params: AuditLogsParams = {}): Promise<PaginatedResponse<AuditLog>> => {
    const { data } = await apiClient.get('/admin/audit-logs', { params })
    return data
  },
}
