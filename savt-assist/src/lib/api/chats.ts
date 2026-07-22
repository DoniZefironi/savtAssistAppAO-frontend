import { apiClient } from './client'
import type { Chat, ChatAttachment, ChatMessage, MessageAttachment } from '@/types'

export interface MessageSearchResult {
  id: number
  chat_id: number
  chat_type: string
  cabinet_object_number: string | null
  chat_user_id: number
  sender_id: number
  sender_name: string
  text: string
  created_at: string
  attachments: unknown[]
}

/** Персональные настройки вида чата (per-user). chat_id=null — глобальные. */
export interface ChatSettings {
  user_id: number
  chat_id: number | null
  own_bubble_color: string | null
  other_bubble_color: string | null
  bot_bubble_color: string | null
  own_text_color: string | null
  other_text_color: string | null
  bot_text_color: string | null
  nick_color: string | null
  font_size: number | null
  wallpaper_id: string | null
  wallpaper_url: string | null
}

export type ChatSettingsPatch = Partial<Omit<ChatSettings, 'user_id' | 'chat_id'>>

export interface GetChatsParams {
  search?: string
  chat_type?: 'cabinet' | 'support' | 'service_request'
  // false (по умолч. на бэкенде) — активные; true — архив (чаты закрытых заявок)
  archived?: boolean
}

export const chatsApi = {
  getChats: async (params: GetChatsParams = {}): Promise<Chat[]> => {
    const { data } = await apiClient.get<Chat[]>('/operator/chats', { params })
    return data
  },

  getMessages: async (chatId: number, beforeId?: number, afterId?: number, search?: string): Promise<ChatMessage[]> => {
    const { data } = await apiClient.get<ChatMessage[]>(`/operator/chats/${chatId}/messages`, {
      params: {
        limit: 30,
        ...(beforeId ? { before_id: beforeId } : {}),
        ...(afterId ? { after_id: afterId } : {}),
        ...(search ? { search } : {}),
      },
    })
    return data
  },

  sendMessage: async (
    chatId: number,
    text: string,
    attachments?: Omit<MessageAttachment, 'duration_seconds'>[],
    replyToId?: number
  ): Promise<ChatMessage> => {
    const { data } = await apiClient.post<ChatMessage>(`/operator/chats/${chatId}/messages`, {
      text: text || undefined,
      attachments: attachments?.length ? attachments : undefined,
      reply_to_message_id: replyToId || undefined,
    })
    return data
  },

  editMessage: async (chatId: number, messageId: number, text: string): Promise<ChatMessage> => {
    const { data } = await apiClient.patch<ChatMessage>(`/chats/${chatId}/messages/${messageId}`, { text })
    return data
  },

  deleteMessage: async (chatId: number, messageId: number): Promise<void> => {
    await apiClient.delete(`/chats/${chatId}/messages/${messageId}`)
  },

  addReaction: async (chatId: number, messageId: number, emoji: string): Promise<void> => {
    await apiClient.post(`/chats/${chatId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`)
  },

  removeReaction: async (chatId: number, messageId: number, emoji: string): Promise<void> => {
    await apiClient.delete(`/chats/${chatId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`)
  },

  uploadAttachment: async (file: File): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await apiClient.post('/upload/attachment', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  uploadVoice: async (blob: Blob): Promise<{ url: string }> => {
    const form = new FormData()
    form.append('file', new File([blob], 'voice.ogg', { type: blob.type || 'audio/ogg' }))
    const { data } = await apiClient.post('/upload/voice', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  // Закрепы — массив (до 10 на чат). PUT/DELETE возвращают актуальный список,
  // поэтому второй запрос за списком не нужен.
  pinMessage: async (chatId: number, messageId: number): Promise<ChatMessage[]> => {
    const { data } = await apiClient.put<ChatMessage[]>(`/operator/chats/${chatId}/pin/${messageId}`)
    return data
  },

  unpinMessage: async (chatId: number, messageId: number): Promise<ChatMessage[]> => {
    const { data } = await apiClient.delete<ChatMessage[]>(`/operator/chats/${chatId}/pin/${messageId}`)
    return data
  },

  unpinAll: async (chatId: number): Promise<ChatMessage[]> => {
    const { data } = await apiClient.delete<ChatMessage[]>(`/operator/chats/${chatId}/pin`)
    return data
  },

  getPinnedMessages: async (chatId: number): Promise<ChatMessage[]> => {
    try {
      const { data } = await apiClient.get<ChatMessage[]>(`/operator/chats/${chatId}/pinned`)
      return data ?? []
    } catch {
      return []
    }
  },

  getAttachments: async (chatId: number): Promise<ChatAttachment[]> => {
    const { data } = await apiClient.get<ChatAttachment[]>(`/operator/chats/${chatId}/attachments`)
    return data
  },

  clearHistory: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/operator/chats/${chatId}/messages`)
  },

  deleteChat: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/operator/chats/${chatId}`)
  },

  getMessagesAround: async (chatId: number, aroundId: number, limit = 30): Promise<ChatMessage[]> => {
    const { data } = await apiClient.get<ChatMessage[]>(`/operator/chats/${chatId}/messages`, {
      params: { around_id: aroundId, limit },
    })
    return data
  },

  searchAllMessages: async (q: string, page = 1, size = 20): Promise<{ items: MessageSearchResult[]; total: number; page: number; pages: number }> => {
    const { data } = await apiClient.get('/operator/messages', { params: { q, page, size } })
    return data
  },

  transcribeVoice: async (audioUrl: string): Promise<{ text: string }> => {
    // Длинные голосовые (>1 МБ) сервер обрабатывает синхронно через Yandex до ~100с,
    // поэтому таймаут запроса поднят до 120с (короткие отвечают за 1-3с).
    const { data } = await apiClient.post<{ text: string }>(
      '/upload/transcribe',
      { file_url: audioUrl },
      { timeout: 120_000 },
    )
    return data
  },

  markRead: async (chatId: number): Promise<void> => {
    await apiClient.post(`/chats/${chatId}/read`)
  },

  takeChat: async (chatId: number): Promise<void> => {
    await apiClient.post(`/operator/chats/${chatId}/take`)
  },

  returnToBot: async (chatId: number): Promise<void> => {
    await apiClient.post(`/operator/chats/${chatId}/return-to-bot`)
  },

  // Персональные настройки вида чата (цвета, шрифт, обои) — per-user, синхронизируются
  // между устройствами. Глобальные + per-chat override (override имеет приоритет).
  getGlobalSettings: async (): Promise<ChatSettings> => {
    const { data } = await apiClient.get<ChatSettings>('/operator/chats/settings')
    return data
  },

  updateGlobalSettings: async (patch: ChatSettingsPatch): Promise<ChatSettings> => {
    const { data } = await apiClient.patch<ChatSettings>('/operator/chats/settings', patch)
    return data
  },

  /** Эффективные настройки чата: per-chat override, иначе глобальные. */
  getChatSettings: async (chatId: number): Promise<ChatSettings> => {
    const { data } = await apiClient.get<ChatSettings>(`/operator/chats/${chatId}/settings`)
    return data
  },

  updateChatSettings: async (chatId: number, patch: ChatSettingsPatch): Promise<ChatSettings> => {
    const { data } = await apiClient.patch<ChatSettings>(`/operator/chats/${chatId}/settings`, patch)
    return data
  },

  /** Сбросить per-chat override (откат к глобальным). */
  resetChatSettings: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/operator/chats/${chatId}/settings`)
  },
}
