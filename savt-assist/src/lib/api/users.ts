import { apiClient } from './client'
import type { PaginatedResponse } from '@/types'

export interface AdminUser {
  id: number
  // phone — подтверждённый номер из Telegram (логин), contact_phone — рабочий
  // номер, указанный самим пользователем и ничем не подтверждённый.
  phone: string | null
  contact_phone?: string | null
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
  // Доступ к ШУ выводится из проекта целиком, не хранится по-шкафно — карточка
  // пользователя показывает проекты, в которых он состоит, а не отдельные ШУ
  // (см. README-backend.md, GET /admin/users/{id}). Переход по строке должен
  // вести на карточку проекта.
  projects: UserProject[]
}

export interface UserProject {
  project_id: number
  name: string
  is_primary: boolean
  // Сколько шкафов вообще в проекте — не значит, что у пользователя к каждому
  // отдельный доступ: он либо есть ко всем шкафам проекта, либо ни к одному.
  cabinet_count: number
  company_name: string | null
  warranty_status: 'active' | 'expiring_soon' | 'expired' | 'none'
}

interface ListParams {
  search?: string
  is_active?: boolean
  is_verified?: boolean
  is_phone_verified?: boolean
  user_type?: 'individual' | 'organization'
  role?: string
  sort_by?: string
  sort_order?: string
  page?: number
  size?: number
}

export const usersApi = {
  getUserList: (params?: ListParams): Promise<PaginatedResponse<AdminUser>> =>
    apiClient.get('/admin/users', { params }).then(r => r.data),

  getOperatorList: (params?: ListParams): Promise<PaginatedResponse<AdminUser>> =>
    apiClient.get('/admin/operators', { params }).then(r => r.data),

  getAdminList: (params?: ListParams): Promise<PaginatedResponse<AdminUser>> =>
    apiClient.get('/admin/admins', { params }).then(r => r.data),

  /** @deprecated use getUserList / getOperatorList / getAdminList */
  getList: (params?: ListParams): Promise<PaginatedResponse<AdminUser>> =>
    apiClient.get('/admin/users', { params }).then(r => r.data),

  getOne: (id: number): Promise<AdminUserDetail> =>
    apiClient.get(`/admin/users/${id}`).then(r => r.data),

  /** Деталь админа — только для суперадмина (GET /admin/admins/{id}). */
  getAdminOne: (id: number): Promise<AdminUserDetail> =>
    apiClient.get(`/admin/admins/${id}`).then(r => r.data),

  createOperator: (data: { login: string; password: string; full_name?: string | null }): Promise<AdminUser> =>
    apiClient.post('/admin/users/operators', data).then(r => r.data),

  deleteOperator: (id: number): Promise<void> =>
    apiClient.delete(`/admin/users/operators/${id}`).then(() => undefined),

  createAdmin: (data: { login: string; password: string; full_name?: string | null }): Promise<AdminUser> =>
    apiClient.post('/admin/admins', data).then(r => r.data),

  // Только суперадмин. Механика как у удаления оператора: сессии отзываются,
  // аккаунт деактивируется и обезличивается, но из базы не стирается — на него
  // ссылаются журнал действий и обработанные заявки. Суперадмина этим
  // эндпоинтом удалить нельзя (403), как и самого себя.
  deleteAdmin: (id: number): Promise<void> =>
    apiClient.delete(`/admin/admins/${id}`).then(() => undefined),

  verify: (id: number) => apiClient.post(`/admin/users/${id}/verify`, {}),
  unverify: (id: number) => apiClient.post(`/admin/users/${id}/unverify`, {}),
  ban: (id: number, reason: string) => apiClient.post(`/admin/users/${id}/ban`, { reason }),
  unban: (id: number) => apiClient.post(`/admin/users/${id}/unban`, {}),
}
