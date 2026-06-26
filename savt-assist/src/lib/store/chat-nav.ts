'use client'

import { create } from 'zustand'

interface ChatNavStore {
  pendingChatId: number | null
  pendingMessageId: number | null
  setPendingChatId: (id: number | null) => void
  setPending: (chatId: number, messageId: number | null) => void
  clearPendingMessage: () => void
}

export const useChatNavStore = create<ChatNavStore>((set) => ({
  pendingChatId: null,
  pendingMessageId: null,
  setPendingChatId: (id) => set({ pendingChatId: id }),
  setPending: (chatId, messageId) => set({ pendingChatId: chatId, pendingMessageId: messageId }),
  clearPendingMessage: () => set({ pendingMessageId: null }),
}))
