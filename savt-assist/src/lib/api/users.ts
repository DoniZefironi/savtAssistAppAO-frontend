import { apiClient } from './client'
import type { PaginatedResponse } from '@/types'

export interface AdminUser {
  id: number
  phone: string | null
  login: string | null
  full_name: string | null
  user_type: string | null
  organization_name: string | null
  role: string
  is_active: boolean
  is_phone_verified: boolean
  is_verified: boolean
  created_at: string
}

export interface AdminUserDetail extends AdminUser {
  email: string | null
  cabinets: UserCabinet[]
}

export interface UserCabinet {
  cabinet_id: number
  type: string
  object_number: string
  warranty_ends_at: string
  warranty_status: string
  custom_name: string | null
  is_primary: boolean
  added_at: string
}

interface ListParams {
  search?: string
  is_active?: boolean
  role?: string
  sort_by?: string
  sort_order?: string
  page?: number
  size?: number
}

export const usersApi = {
  getList: (params?: ListParams): Promise<PaginatedResponse<AdminUser>> =>
    apiClient.get('/admin/users', { params }).then(r => r.data),

  getOne: (id: number): Promise<AdminUserDetail> =>
    apiClient.get(`/admin/users/${id}`).then(r => r.data),

  createOperator: (data: { login: string; password: string; full_name?: string | null }): Promise<AdminUser> =>
    apiClient.post('/admin/operators', data).then(r => r.data),

  deleteOperator: (id: number): Promise<void> =>
    apiClient.delete(`/admin/operators/${id}`).then(() => undefined),

  createAdmin: (data: { login: string; password: string; full_name?: string | null }): Promise<AdminUser> =>
    apiClient.post('/admin/admins', data).then(r => r.data),

  verify: (id: number) => apiClient.post(`/admin/users/${id}/verify`, {}),
  unverify: (id: number) => apiClient.post(`/admin/users/${id}/unverify`, {}),
  ban: (id: number, reason: string) => apiClient.post(`/admin/users/${id}/ban`, { reason }),
  unban: (id: number) => apiClient.post(`/admin/users/${id}/unban`, {}),
}
