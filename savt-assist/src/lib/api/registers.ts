import { apiClient } from './client'
import type { PaginatedResponse, RegisterDefinition, RegisterOverride, TelemetryEntry } from '@/types'

export interface RegisterDto {
  address: number
  name: string
  description?: string | null
}

export interface TelemetryParams {
  page?: number
  size?: number
}

export const registersApi = {
  getDefinitions: async (): Promise<RegisterDefinition[]> => {
    const { data } = await apiClient.get('/admin/register-definitions')
    return data
  },

  createDefinition: async (dto: RegisterDto): Promise<RegisterDefinition> => {
    const { data } = await apiClient.post('/admin/register-definitions', dto)
    return data
  },

  deleteDefinition: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/register-definitions/${id}`)
  },

  getOverrides: async (cabinetId: number): Promise<RegisterOverride[]> => {
    const { data } = await apiClient.get(`/admin/cabinets/${cabinetId}/register-overrides`)
    return data
  },

  createOverride: async (cabinetId: number, dto: RegisterDto): Promise<RegisterOverride> => {
    const { data } = await apiClient.post(`/admin/cabinets/${cabinetId}/register-overrides`, dto)
    return data
  },

  deleteOverride: async (cabinetId: number, overrideId: number): Promise<void> => {
    await apiClient.delete(`/admin/cabinets/${cabinetId}/register-overrides/${overrideId}`)
  },

  // Отдельный от мобильного (GET /cabinets/{id}/telemetry) эндпоинт — без
  // проверки членства в проекте, доступен админу/оператору для любого ШУ.
  getTelemetry: async (cabinetId: number, params: TelemetryParams = {}): Promise<PaginatedResponse<TelemetryEntry>> => {
    const { data } = await apiClient.get(`/admin/cabinets/${cabinetId}/telemetry`, { params })
    return data
  },
}
