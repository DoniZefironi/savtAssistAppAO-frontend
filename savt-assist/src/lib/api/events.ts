import { apiClient } from './client'

export interface StreamTicket {
  ticket: string
  expires_in: number
}

export const eventsApi = {
  // Одноразовый короткоживущий (30с) тикет для авторизации SSE-подключения —
  // EventSource не умеет слать заголовок Authorization, поэтому JWT в query
  // не кладём, вместо этого обмениваем Bearer-токен на тикет обычным REST-запросом.
  getTicket: async (): Promise<StreamTicket> => {
    const { data } = await apiClient.post<StreamTicket>('/operator/events/ticket')
    return data
  },
}
