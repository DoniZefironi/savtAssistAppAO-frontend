import { apiClient } from './client'
import type {
  PaginatedResponse, ReclamationDetail, ReclamationListItem, ReclamationObjectType, ReclamationStatus,
} from '@/types'

export interface ReclamationListParams {
  status?: ReclamationStatus
  object_type?: ReclamationObjectType
  warranty_classification?: boolean
  page?: number
  size?: number
}

// Частичное обновление — шлём только реально изменённые поля, как везде в
// проекте. Обязательные проверки на смену статуса (400 при нарушении) —
// на сервере, но дублируются на клиенте (см. reclamation-dialog.tsx), чтобы
// не ловить 400 вслепую:
// - rejected без rejection_reason нельзя;
// - resolved без resolution_comment нельзя;
// - in_progress без responsible_name и без warranty_classification нельзя
//   (оба должны быть заданы либо уже раньше, либо этим же запросом).
export interface ReclamationPatchDto {
  status?: ReclamationStatus
  warranty_classification?: boolean | null
  responsible_name?: string | null
  responsible_phone?: string | null
  rejection_reason?: string | null
  resolution_comment?: string | null
  root_cause?: string | null
}

// Только admin — оператору эти эндпоинты недоступны (403), см.
// README-backend.md, «Рут reclamations».
export const reclamationsApi = {
  getAll: async (params?: ReclamationListParams): Promise<PaginatedResponse<ReclamationListItem>> => {
    const { data } = await apiClient.get('/admin/reclamations', { params })
    return data
  },

  getOne: async (id: number): Promise<ReclamationDetail> => {
    const { data } = await apiClient.get(`/admin/reclamations/${id}`)
    return data
  },

  update: async (id: number, patch: ReclamationPatchDto): Promise<ReclamationDetail> => {
    const { data } = await apiClient.patch(`/admin/reclamations/${id}`, patch)
    return data
  },
}
