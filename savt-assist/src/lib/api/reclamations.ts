import { apiClient } from './client'
import type {
  PaginatedResponse, ReclamationBitrixDetachedItem, ReclamationBitrixOutboxItem, ReclamationBitrixUser,
  ReclamationDetail, ReclamationListItem, ReclamationObjectType, ReclamationStatus,
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
// - rejected и invalid без rejection_reason нельзя;
// - resolved без resolution_comment И без confirmation_file_url нельзя —
//   «Нельзя закрыть рекламацию без подтверждающего документа»;
// - in_progress без responsible_name и без warranty_classification нельзя
//   (оба должны быть заданы либо уже раньше, либо этим же запросом).
export interface ReclamationPatchDto {
  status?: ReclamationStatus
  warranty_classification?: boolean | null
  responsible_name?: string | null
  responsible_phone?: string | null
  // Дублирует назначение в самой карточке Bitrix — необязательное, если
  // Bitrix для этой рекламации не настроен, просто не сработает, без ошибки
  // (см. README-backend.md, «Рут reclamations»). Не возвращается ни в одном
  // GET — write-only, как mqtt_password у ШУ.
  responsible_bitrix_user_id?: number | null
  rejection_reason?: string | null
  resolution_comment?: string | null
  root_cause?: string | null
  confirmation_file_url?: string | null
  confirmation_file_name?: string | null
  // Срок отработки, «ГГГГ-ММ-ДД». null очищает. Bitrix требует это поле при
  // переводе карточки между стадиями — если не задано, сервер подставит
  // «сегодня + 7 дней», чтобы переход не сорвался, но это заглушка, а не
  // обещанный заказчику срок (предупреждаем об этом в форме).
  deadline_at?: string | null
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

  // Для дропдауна «Ответственный» в форме обработки — не свободный текст.
  getBitrixUsers: async (): Promise<ReclamationBitrixUser[]> => {
    const { data } = await apiClient.get('/admin/reclamations/bitrix-users')
    return data
  },

  // Что не долетело до Bitrix и почему. В норме пустой — строки появляются
  // только на сбоях и исчезают сами, когда фоновый повтор пройдёт успешно.
  getBitrixOutbox: async (): Promise<ReclamationBitrixOutboxItem[]> => {
    const { data } = await apiClient.get('/admin/reclamations/bitrix-outbox')
    return data
  },

  // Заявки, чью карточку удалили в Bitrix. В норме пустой.
  getBitrixDetached: async (): Promise<ReclamationBitrixDetachedItem[]> => {
    const { data } = await apiClient.get('/admin/reclamations/bitrix-detached')
    return data
  },

  // Подтверждающий документ при закрытии (акт, фото выполненной работы и
  // т.п.) — тот же общий эндпоинт загрузки, что и вложения при подаче самой
  // рекламации (см. README-backend.md, «Рут reclamations» → confirmation_file_url).
  // Возвращает подписанный url, который потом уходит в PATCH как есть.
  uploadAttachment: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await apiClient.post('/upload/attachment', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}
