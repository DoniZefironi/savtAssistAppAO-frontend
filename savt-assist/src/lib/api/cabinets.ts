import { apiClient } from './client'
import type { Cabinet, PaginatedResponse } from '@/types'

export interface CabinetsParams {
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  size?: number
  has_documents?: boolean
  has_photos?: boolean
  has_users?: boolean
  has_service_requests?: boolean
  warranty_status?: 'active' | 'expired' | 'none'
  tag_ids?: number[]
  // false — только ШУ без привязанного проекта (см. обсуждение расширения
  // GET /admin/cabinets в контексте раздела "Проекты ШУ")
  has_project?: boolean
  // Шкафы конкретного проекта — используется страницей проекта вместо
  // усечённого cabinets[] из GET /admin/projects/{id}, чтобы переиспользовать
  // тот же полный Cabinet-объект и всю существующую фильтрацию/поиск/сортировку
  project_id?: number
}

export interface CreateCabinetDto {
  type: string
  object_number: string
  admin_internal_name?: string | null
  description?: string | null
  purpose?: string | null
  admin_comment?: string | null
  warranty_starts_at?: string | null
  warranty_ends_at?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface CabinetUser {
  user_id: number
  full_name: string | null
  phone: string | null
  user_type: string | null
  is_primary: boolean
  custom_name: string | null
  added_at: string
}

export interface UpdateCabinetDto {
  type?: string | null
  object_number?: string | null
  admin_internal_name?: string | null
  description?: string | null
  purpose?: string | null
  admin_comment?: string | null
  warranty_starts_at?: string | null
  warranty_ends_at?: string | null
  latitude?: number | null
  longitude?: number | null
}

export const cabinetsApi = {
  getAll: async (params: CabinetsParams = {}): Promise<PaginatedResponse<Cabinet>> => {
    const { data } = await apiClient.get('/admin/cabinets', { params })
    return data
  },

  getOne: async (id: number): Promise<Cabinet> => {
    const { data } = await apiClient.get(`/admin/cabinets/${id}`)
    return data
  },

  create: async (dto: CreateCabinetDto): Promise<Cabinet> => {
    const { data } = await apiClient.post('/admin/cabinets', dto)
    return data
  },

  update: async (id: number, dto: UpdateCabinetDto): Promise<Cabinet> => {
    const { data } = await apiClient.patch(`/admin/cabinets/${id}`, dto)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/cabinets/${id}`)
  },

  updateCabinetTags: (cabinetId: number, tagIds: number[]): Promise<void> =>
    apiClient.put(`/admin/cabinets/${cabinetId}/tags`, { tag_ids: tagIds }).then(() => undefined),

  setProject: (cabinetId: number, projectId: number | null): Promise<void> =>
    apiClient.patch(`/admin/cabinets/${cabinetId}/project`, { project_id: projectId }).then(() => undefined),

  getCabinetUsers: async (cabinetId: number): Promise<CabinetUser[]> => {
    const { data } = await apiClient.get(`/admin/cabinets/${cabinetId}/users`)
    return data
  },

  removeCabinetUser: async (cabinetId: number, userId: number, reason: string): Promise<void> => {
    await apiClient.delete(`/admin/cabinets/${cabinetId}/users/${userId}`, { data: { reason } })
  },

  getQr: async (id: number): Promise<Blob> => {
    const { data } = await apiClient.get(`/admin/cabinets/${id}/qr`, { responseType: 'blob' })
    return data
  },

  getCabinetsGeo: async (): Promise<CabinetGeoItem[]> => {
    const { data } = await apiClient.get('/admin/cabinets/geo')
    return data
  },

  getDashboard: async (): Promise<DashboardData> => {
    const { data } = await apiClient.get('/admin/dashboard')
    const s = data.stats ?? {}
    const activity: ActivityItem[] = (data.recent_activity ?? []).map((item: DashboardActivityRaw) => ({
      id: item.id,
      type: item.type,
      label: ACTIVITY_LABELS[item.type] ?? item.type,
      user: item.user_full_name ?? null,
      detail: item.detail ?? '',
      status: item.status,
      created_at: item.created_at,
    }))
    return {
      stats: {
        unreadChats: s.unread_chats ?? 0,
        openServiceRequests: s.open_service_requests ?? 0,
        pendingDocumentRequests: s.pending_document_requests ?? 0,
        pendingShareRequests: s.pending_share_requests ?? 0,
        pendingAdditionRequests: s.pending_addition_requests ?? 0,
      },
      activity,
    }
  },
}

export interface ActivityItem {
  id: number
  type: 'service' | 'document' | 'share' | 'addition'
  label: string
  user: string | null
  detail: string
  status: string
  created_at: string
}

export interface DashboardStats {
  unreadChats: number
  openServiceRequests: number
  pendingDocumentRequests: number
  pendingShareRequests: number
  pendingAdditionRequests: number
}

export interface DashboardData {
  stats: DashboardStats
  activity: ActivityItem[]
}

interface DashboardActivityRaw {
  id: number
  type: 'service' | 'document' | 'share' | 'addition'
  status: string
  user_full_name?: string | null
  detail?: string
  created_at: string
}

export interface CabinetGeoItem {
  id: number
  object_number: string
  admin_internal_name: string | null
  warranty_ends_at: string | null
  warranty_status: 'active' | 'expiring_soon' | 'expired' | null
  latitude: number | null
  longitude: number | null
  has_open_requests: boolean
}

const ACTIVITY_LABELS: Record<string, string> = {
  service: 'Сервисная заявка',
  document: 'Запрос на документ',
  share: 'Доступ к ШУ',
  addition: 'Добавление ШУ',
}
