import { apiClient } from './client'
import type { PaginatedResponse, SimInfoOut } from '@/types'

export interface SimSearchParams {
  name?: string
  phone?: string
  serial_number?: string
  ip?: string
  page?: number
  size?: number
}

export const simApi = {
  // При недоступности внешнего сервиса с данными SIM ручка отдаёт пустой
  // список, а не ошибку — на UI это неотличимо от "ничего не найдено"
  // (см. README-backend.md, «Рут admin: sim»).
  getAll: async (params: SimSearchParams = {}): Promise<PaginatedResponse<SimInfoOut>> => {
    const { data } = await apiClient.get('/admin/sim', { params })
    return data
  },
}
