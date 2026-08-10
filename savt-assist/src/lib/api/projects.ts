import { apiClient } from './client'
import type { Project, ProjectDetail, PaginatedResponse } from '@/types'

// Фильтры по вложенным ШУ: проект попадает в выдачу, если условиям
// соответствует хотя бы один его шкаф.
//
// ВНИМАНИЕ про гарантию: здесь она называется `cabinet_warranty_status`.
// Раньше параметр звался `warranty_status` и означал именно гарантию шкафов,
// но теперь `warranty_status` на /admin/projects относится к гарантии САМОГО
// проекта (см. ProjectOwnFilters) и совпадает с одноимённой колонкой в выдаче.
// Путать их нельзя — оба валидны, но отбирают разное.
export interface ProjectCabinetFilters {
  has_documents?: boolean
  has_photos?: boolean
  has_users?: boolean
  has_service_requests?: boolean
  cabinet_warranty_status?: 'active' | 'expiring_soon' | 'expired' | 'none'
  tag_ids?: number[]
}

// Фильтры по самому проекту — не по его шкафам.
export interface ProjectOwnFilters {
  // Год из производственного номера (26_170 → 2026); у заведённых вручную —
  // по дате создания. Тот же год, по которому разложены папки на NAS.
  year?: number
  company?: string
  shipped?: boolean
  shipment_planned_from?: string
  shipment_planned_to?: string
  shipment_actual_from?: string
  shipment_actual_to?: string
  has_project_documents?: boolean
  has_project_photos?: boolean
  has_project_users?: boolean
  has_contacts?: boolean
  warranty_status?: 'active' | 'expiring_soon' | 'expired' | 'none'
}

// Ответ POST /admin/projects/{id}/sync-folder — отчёт о прогоне, не сам проект.
export interface SyncFolderResult {
  synced_at: string
  imported_documents: number
  message: string
}

// Ответ POST /admin/projects/sync-folders — сводка по всем проектам разом.
export interface SyncAllFoldersResult {
  total_projects: number
  synced_projects: number
  relocated_projects: number
  failed_projects: number
  message: string
}

// Оба набора можно слать вместе — они складываются по И.
export interface ProjectsParams extends ProjectCabinetFilters, ProjectOwnFilters {
  // Поиск нечёткий и покрывает не только карточку проекта (название, номер,
  // компания), но и контактных лиц заказчика: ФИО, должность, телефоны, почты.
  search?: string
  sort_by?: ProjectSortField
  sort_order?: 'asc' | 'desc'
  page?: number
  size?: number
}

export type ProjectSortField =
  | 'name' | 'created_at' | 'production_number' | 'year' | 'company_name'
  | 'shipment_planned_at' | 'shipment_actual_at' | 'warranty_ends_at' | 'cabinet_count'

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

  // Синхронизировать папки всех активных проектов одним запросом (ночной прогон
  // по кнопке). В отличие от syncFolder — по-прежнему пропускает полную сверку
  // проектов с истёкшей гарантией (только переносит папку в годовую), см.
  // README-backend.md.
  syncAllFolders: async (): Promise<SyncAllFoldersResult> => {
    const { data } = await apiClient.post('/admin/projects/sync-folders')
    return data
  },
}
