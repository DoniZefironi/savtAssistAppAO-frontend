import { apiClient } from './client'
import type {
  PaginatedResponse, ReclamationBitrixDetachedItem, ReclamationBitrixOutboxItem,
  ReclamationDetail, ReclamationListItem, ReclamationObjectType, ReclamationStatus,
} from '@/types'

export interface ReclamationListParams {
  status?: ReclamationStatus
  object_type?: ReclamationObjectType
  warranty_classification?: boolean
  page?: number
  size?: number
}

// Только admin — оператору эти эндпоинты недоступны (403), см.
// README-backend.md, «Рут reclamations». Обработки через админку нет: статус,
// гарантию, ответственного и срок меняет специалист в Bitrix, к нам это
// приезжает вебхуком. Ручек, меняющих состояние рекламации, у админки нет —
// только повторная отправка в Bitrix, если рекламация туда не доехала.
export const reclamationsApi = {
  getAll: async (params?: ReclamationListParams): Promise<PaginatedResponse<ReclamationListItem>> => {
    const { data } = await apiClient.get('/admin/reclamations', { params })
    return data
  },

  getOne: async (id: number): Promise<ReclamationDetail> => {
    const { data } = await apiClient.get(`/admin/reclamations/${id}`)
    return data
  },

  // Что не долетело до Bitrix и почему. В норме пустой — строки появляются
  // только на сбоях и исчезают сами, когда фоновый повтор пройдёт успешно.
  getBitrixOutbox: async (): Promise<ReclamationBitrixOutboxItem[]> => {
    const { data } = await apiClient.get('/admin/reclamations/bitrix-outbox')
    return data
  },

  // Ручная правка застрявшего payload — на крайний случай, когда авторетрай
  // сам никогда не пройдёт (например, в payload create пустой company_id).
  // Тело целиком заменяет payload строки, сразу следом — попытка отправки, не
  // дожидаясь 15-минутного цикла. success:false — снова не прошло, row несёт
  // обновлённый last_error, чтобы сразу видеть, чего ещё не хватает.
  updateBitrixOutbox: async (id: number, payload: Record<string, unknown>): Promise<{ success: boolean; row: ReclamationBitrixOutboxItem | null }> => {
    const { data } = await apiClient.patch(`/admin/reclamations/bitrix-outbox/${id}`, { payload })
    return data
  },

  // Снять операцию с повторов насовсем (если чинить не планируется) — не
  // трогает саму рекламацию, только эту одну строку очереди.
  deleteBitrixOutbox: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/reclamations/bitrix-outbox/${id}`)
  },

  // Заявки, чью карточку удалили в Bitrix. В норме пустой.
  getBitrixDetached: async (): Promise<ReclamationBitrixDetachedItem[]> => {
    const { data } = await apiClient.get('/admin/reclamations/bitrix-detached')
    return data
  },

  // Окончательное удаление — ТОЛЬКО для рекламаций из bitrix-detached (карточку
  // в Bitrix уже удалили), для любой другой 400: у живой осталась бы карточка
  // на портале без пары у нас. Уходят и вложения, у заявителя она тоже
  // пропадает; в журнале аудита остаётся reclamation.delete.
  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/admin/reclamations/${id}`)
  },
}
