import { apiClient } from './client'
import type { Project, ProjectDetail, PaginatedResponse } from '@/types'

// Фильтры по вложенным ШУ (has_documents/has_photos/...) — задуманы как
// "проект матчит, если хотя бы один его шкаф удовлетворяет всем условиям".
// Требует расширения бэкенда на GET /admin/projects и GET /admin/projects/{id}
// теми же параметрами, что уже поддерживает GET /admin/cabinets — см.
// обсуждение переезда "Проектов" внутрь "Проекты ШУ".
export interface ProjectCabinetFilters {
  has_documents?: boolean
  has_photos?: boolean
  has_users?: boolean
  has_service_requests?: boolean
  warranty_status?: 'active' | 'expired' | 'none'
  tag_ids?: number[]
}

export interface ProjectsParams extends ProjectCabinetFilters {
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  page?: number
  size?: number
}

export const projectsApi = {
  getAll: async (params: ProjectsParams = {}): Promise<PaginatedResponse<Project>> => {
    const { data } = await apiClient.get('/admin/projects', { params })
    return data
  },

  // filters — если заданы, cabinets в ответе уже отфильтрован бэкендом до
  // подходящих шкафов (см. ProjectCabinetFilters)
  getOne: async (id: number, filters: ProjectCabinetFilters = {}): Promise<ProjectDetail> => {
    const { data } = await apiClient.get(`/admin/projects/${id}`, { params: filters })
    return data
  },

  create: async (name: string): Promise<ProjectDetail> => {
    const { data } = await apiClient.post('/admin/projects', { name })
    return data
  },

  update: async (id: number, name: string): Promise<ProjectDetail> => {
    const { data } = await apiClient.patch(`/admin/projects/${id}`, { name })
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/projects/${id}`)
  },

  getQr: async (id: number): Promise<Blob> => {
    const { data } = await apiClient.get(`/admin/projects/${id}/qr`, { responseType: 'blob' })
    return data
  },
}
