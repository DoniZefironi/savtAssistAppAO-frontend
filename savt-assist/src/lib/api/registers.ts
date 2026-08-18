import { apiClient } from './client'
import type { PaginatedResponse, RegisterDefinition, RegisterOverride, TelemetryEntry, TelemetryLiveState } from '@/types'

export interface RegisterDto {
  address: number
  // Обязателен — каждая строка карты описывает конкретный бит (0-15)
  // конкретного адреса, не весь регистр целиком.
  bit: number
  name: string
  description?: string | null
}

// PATCH — любое подмножество полей, только для редактирования уже
// существующей строки карты (см. README-backend.md, «Рут admin: telemetry»).
export type RegisterPatchDto = Partial<RegisterDto>

export interface TelemetryParams {
  page?: number
  size?: number
  // false (по умолч.) — только именованные регистры, сообщения без единого
  // именованного регистра пропадают из ответа целиком. true — всё как есть,
  // включая name: null (нужно при заполнении карты регистров, чтобы видеть
  // сырые значения). total/pages считаются по сырым событиям в БД, до этого
  // фильтра — на "странице" реально показанных элементов может быть меньше
  // size, вплоть до нуля, это не баг (см. README-backend.md, «Рут admin: telemetry»).
  include_unnamed?: boolean
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

  updateDefinition: async (id: number, dto: RegisterPatchDto): Promise<RegisterDefinition> => {
    const { data } = await apiClient.patch(`/admin/register-definitions/${id}`, dto)
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

  updateOverride: async (cabinetId: number, overrideId: number, dto: RegisterPatchDto): Promise<RegisterOverride> => {
    const { data } = await apiClient.patch(`/admin/cabinets/${cabinetId}/register-overrides/${overrideId}`, dto)
    return data
  },

  deleteOverride: async (cabinetId: number, overrideId: number): Promise<void> => {
    await apiClient.delete(`/admin/cabinets/${cabinetId}/register-overrides/${overrideId}`)
  },

  // Текущее состояние карты регистров прямо сейчас — плоский список без
  // пагинации (см. README-backend.md, «Рут admin: telemetry»). Отдельный
  // от мобильного (GET /cabinets/{id}/telemetry) эндпоинт — без проверки
  // членства в проекте, доступен админу/оператору для любого ШУ.
  getTelemetry: async (cabinetId: number, params: Pick<TelemetryParams, 'include_unnamed'> = {}): Promise<TelemetryLiveState> => {
    const { data } = await apiClient.get(`/admin/cabinets/${cabinetId}/telemetry`, { params })
    return data
  },

  // Пагинированная лента сырых событий — переехала сюда с GET .../telemetry
  // (для истории/разбора аварии), формат ответа не менялся.
  getTelemetryHistory: async (cabinetId: number, params: TelemetryParams = {}): Promise<PaginatedResponse<TelemetryEntry>> => {
    const { data } = await apiClient.get(`/admin/cabinets/${cabinetId}/telemetry/history`, { params })
    return data
  },
}
