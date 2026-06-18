import { apiClient } from './client'
import type { Chat, ChatMessage, MessageAttachment } from '@/types'

export const chatsApi = {
  getChats: async (search?: string): Promise<Chat[]> => {
    const { data } = await apiClient.get<Chat[]>('/operator/chats', {
      params: search ? { search } : {},
    })
    return data
  },

  getMessages: async (chatId: number, beforeId?: number, search?: string): Promise<ChatMessage[]> => {
    const { data } = await apiClient.get<ChatMessage[]>(`/operator/chats/${chatId}/messages`, {
      params: {
        limit: 30,
        ...(beforeId ? { before_id: beforeId } : {}),
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

  pinMessage: async (chatId: number, messageId: number): Promise<void> => {
    await apiClient.put(`/chats/${chatId}/pin/${messageId}`)
  },

  unpinMessage: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/chats/${chatId}/pin`)
  },

  getPinnedMessage: async (chatId: number): Promise<ChatMessage | null> => {
    try {
      const { data } = await apiClient.get<ChatMessage>(`/operator/chats/${chatId}/pinned`)
      return data
    } catch {
      return null
    }
  },

  clearHistory: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/operator/chats/${chatId}/messages`)
  },

  deleteChat: async (chatId: number): Promise<void> => {
    await apiClient.delete(`/chats/${chatId}`)
  },

  transcribeVoice: async (audioUrl: string): Promise<{ text: string }> => {
    const { data } = await apiClient.post<{ text: string }>('/upload/transcribe', { file_url: audioUrl })
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
}
