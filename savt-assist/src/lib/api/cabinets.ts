import { apiClient } from './client'
import type { Cabinet, PaginatedResponse } from '@/types'

export interface CabinetsParams {
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  size?: number
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
    const [cabinets, serviceReqs, additions, shares, users] = await Promise.allSettled([
      apiClient.get('/admin/cabinets', { params: { page: 1, size: 1 } }),
      apiClient.get('/admin/service-requests', { params: { status: 'open', page: 1, size: 1 } }),
      apiClient.get('/admin/cabinet-requests/additions', { params: { status: 'pending', page: 1, size: 1 } }),
      apiClient.get('/admin/cabinet-requests/shares', { params: { status: 'pending', page: 1, size: 1 } }),
      apiClient.get('/admin/users', { params: { page: 1, size: 1 } }),
    ])

    const getTotal = (r: PromiseSettledResult<{ data: unknown }>) => {
      if (r.status !== 'fulfilled') return 0
      const d = r.value.data as Record<string, unknown>
      if (typeof d?.total === 'number') return d.total
      if (Array.isArray(d)) return d.length
      return 0
    }

    return {
      totalCabinets: getTotal(cabinets),
      openServiceRequests: getTotal(serviceReqs),
      pendingCabinetRequests: getTotal(additions) + getTotal(shares),
      totalUsers: getTotal(users),
    }
  },
}
