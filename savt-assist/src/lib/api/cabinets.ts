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

  getStats: async () => {
    const [serviceReqs, docReqs, shareReqs, additionReqs, chats] = await Promise.allSettled([
      apiClient.get('/admin/service-requests', { params: { status: 'open', page: 1, size: 1 } }),
      apiClient.get('/admin/document-requests', { params: { status: 'pending', page: 1, size: 1 } }),
      apiClient.get('/admin/cabinet-requests/shares', { params: { status: 'pending', page: 1, size: 1 } }),
      apiClient.get('/admin/cabinet-requests/additions', { params: { status: 'pending', page: 1, size: 1 } }),
      apiClient.get('/operator/chats'),
    ])

    const getTotal = (r: PromiseSettledResult<{ data: unknown }>) => {
      if (r.status !== 'fulfilled') return 0
      const d = r.value.data as Record<string, unknown>
      if (typeof d?.total === 'number') return d.total
      if (Array.isArray(d)) return d.length
      return 0
    }

    const chatList = chats.status === 'fulfilled' && Array.isArray(chats.value.data)
      ? (chats.value.data as { unread_count: number }[])
      : []

    return {
      unreadChats: chatList.filter(c => c.unread_count > 0).length,
      openServiceRequests: getTotal(serviceReqs),
      pendingDocumentRequests: getTotal(docReqs),
      pendingShareRequests: getTotal(shareReqs),
      pendingAdditionRequests: getTotal(additionReqs),
    }
  },

  getRecentActivity: async (): Promise<ActivityItem[]> => {
    const [serviceReqs, docReqs, shareReqs, additionReqs] = await Promise.allSettled([
      apiClient.get('/admin/service-requests', { params: { page: 1, size: 6, sort_order: 'desc' } }),
      apiClient.get('/admin/document-requests', { params: { page: 1, size: 6, sort_order: 'desc' } }),
      apiClient.get('/admin/cabinet-requests/shares', { params: { page: 1, size: 6, sort_order: 'desc' } }),
      apiClient.get('/admin/cabinet-requests/additions', { params: { page: 1, size: 6, sort_order: 'desc' } }),
    ])

    const items: ActivityItem[] = []

    const extract = <T extends { id: number; created_at: string }>(
      r: PromiseSettledResult<{ data: { items?: T[] } }>,
      map: (item: T) => Omit<ActivityItem, 'id' | 'created_at'>
    ) => {
      if (r.status !== 'fulfilled') return
      const list = r.value.data?.items ?? []
      for (const item of list) {
        items.push({ id: item.id, created_at: item.created_at, ...map(item) })
      }
    }

    extract(serviceReqs as PromiseSettledResult<{ data: { items?: ServiceReqRaw[] } }>, (item) => ({
      type: 'service',
      label: 'Сервисная заявка',
      user: item.user_full_name,
      detail: item.cabinet_object_number ?? '',
      status: item.status,
    }))

    extract(docReqs as PromiseSettledResult<{ data: { items?: DocReqRaw[] } }>, (item) => ({
      type: 'document',
      label: 'Запрос на документ',
      user: item.user_full_name,
      detail: item.doc_type ?? '',
      status: item.status,
    }))

    extract(shareReqs as PromiseSettledResult<{ data: { items?: ShareReqRaw[] } }>, (item) => ({
      type: 'share',
      label: 'Доступ к ШУ',
      user: item.user_full_name,
      detail: item.cabinet_object_number ?? '',
      status: item.status,
    }))

    extract(additionReqs as PromiseSettledResult<{ data: { items?: AdditionReqRaw[] } }>, (item) => ({
      type: 'addition',
      label: 'Добавление ШУ',
      user: item.user_full_name,
      detail: '',
      status: item.status,
    }))

    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20)
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

interface ServiceReqRaw  { id: number; created_at: string; user_full_name: string | null; cabinet_object_number: string | null; status: string }
interface DocReqRaw      { id: number; created_at: string; user_full_name: string | null; doc_type: string | null; status: string }
interface ShareReqRaw    { id: number; created_at: string; user_full_name: string | null; cabinet_object_number: string | null; status: string }
interface AdditionReqRaw { id: number; created_at: string; user_full_name: string | null; status: string }
