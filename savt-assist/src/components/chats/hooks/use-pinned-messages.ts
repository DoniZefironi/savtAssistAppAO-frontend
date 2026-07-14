import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { chatsApi } from '@/lib/api/chats'
import type { ChatMessage } from '@/types'

// Источник правды по закрепам — отдельный эндпоинт /operator/chats/{id}/pinned (массив,
// новые→старые). Список /operator/chats закрепы не возвращает, поэтому полагаться на chat нельзя.
export function usePinnedMessages(chatId: number) {
  const qc = useQueryClient()

  const { data: pinnedMessages = [] } = useQuery({
    queryKey: ['pinned-messages', chatId],
    queryFn: () => chatsApi.getPinnedMessages(chatId),
    staleTime: 30_000,
  })
  const pinnedIds = useMemo(() => new Set(pinnedMessages.map(m => m.id)), [pinnedMessages])

  // активный закреп в плашке — циклически перебираемый кликом
  const [activePinIdx, setActivePinIdx] = useState(0)
  const activePin = pinnedMessages.length ? pinnedMessages[activePinIdx % pinnedMessages.length] : null
  useEffect(() => { setActivePinIdx(0) }, [chatId])

  const pinMutation = useMutation({
    mutationFn: (messageId: number) => chatsApi.pinMessage(chatId, messageId),
    onSuccess: (list) => {
      qc.setQueryData<ChatMessage[]>(['pinned-messages', chatId], list)
      setActivePinIdx(0)
      toast.success('Сообщение закреплено')
    },
    onError: (e) => toast.error(isAxiosError(e) && e.response?.status === 400 ? 'Достигнут лимит закреплённых (10)' : 'Не удалось закрепить'),
  })

  const unpinMutation = useMutation({
    mutationFn: (messageId: number) => chatsApi.unpinMessage(chatId, messageId),
    onSuccess: (list) => {
      qc.setQueryData<ChatMessage[]>(['pinned-messages', chatId], list)
      setActivePinIdx(0)
    },
    onError: () => toast.error('Не удалось открепить'),
  })

  const unpinAllMutation = useMutation({
    mutationFn: () => chatsApi.unpinAll(chatId),
    onSuccess: (list) => {
      qc.setQueryData<ChatMessage[]>(['pinned-messages', chatId], list)
      setActivePinIdx(0)
    },
    onError: () => toast.error('Не удалось открепить'),
  })

  const handlePin = useCallback((msg: ChatMessage) => {
    if (pinnedIds.has(msg.id)) unpinMutation.mutate(msg.id)
    else pinMutation.mutate(msg.id)
  }, [pinnedIds, pinMutation, unpinMutation])

  return {
    pinnedMessages, pinnedIds, activePin, activePinIdx, setActivePinIdx, handlePin,
    unpinOne: unpinMutation.mutate,
    unpinAll: unpinAllMutation.mutate,
  }
}
