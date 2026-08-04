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

// Ответ POST /admin/projects/{id}/sync-folder — отчёт о прогоне, не сам проект.
export interface SyncFolderResult {
  synced_at: string
  imported_documents: number
  message: string
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

  create: async (name: string, parentProjectId?: number | null): Promise<ProjectDetail> => {
    const { data } = await apiClient.post('/admin/projects', { name, parent_project_id: parentProjectId ?? null })
    return data
  },

  // Все поля опциональны на бэкенде — передавать только изменённые.
  // Поля из Bitrix (shipment_*, company_name, production_number, contacts) этот
  // эндпоинт не принимает: они перезаписываются при изменении сделки.
  update: async (id: number, patch: {
    name?: string
    parent_project_id?: number | null
    warranty_starts_at?: string | null
    warranty_ends_at?: string | null
  }): Promise<ProjectDetail> => {
    const { data } = await apiClient.patch(`/admin/projects/${id}`, patch)
    return data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/projects/${id}`)
  },

  getQr: async (id: number): Promise<Blob> => {
    const { data } = await apiClient.get(`/admin/projects/${id}/qr`, { responseType: 'blob' })
    return data
  },

  // Ручной запуск синхронизации папки проекта на NAS — работает всегда, в
  // отличие от ночного автопрогона (который пропускает проекты с истёкшей
  // гарантией), см. README-backend.md. Доступно оператору и администратору.
  // Отдаёт не проект, а отчёт о прогоне: сколько файлов подхвачено из папки
  // напрямую (положенных туда мимо приложения).
  syncFolder: async (id: number): Promise<SyncFolderResult> => {
    const { data } = await apiClient.post(`/admin/projects/${id}/sync-folder`)
    return data
  },
}
