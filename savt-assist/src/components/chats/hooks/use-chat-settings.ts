import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { chatsApi } from '@/lib/api/chats'
import type { ChatSettingsPatch } from '@/lib/api/chats'
import { toFullUrl } from '../attachment-view'

export type ChatColors = {
  ownBubble?: string; otherBubble?: string; botBubble?: string; nickColor?: string
  fontSize?: number; ownText?: string; otherText?: string; botText?: string
}

// ключ UI-цвета → поле бэкенда (value=undefined => null = сброс)
const COLOR_FIELD: Record<keyof ChatColors, keyof ChatSettingsPatch> = {
  ownBubble: 'own_bubble_color',
  otherBubble: 'other_bubble_color',
  botBubble: 'bot_bubble_color',
  ownText: 'own_text_color',
  otherText: 'other_text_color',
  botText: 'bot_text_color',
  nickColor: 'nick_color',
  fontSize: 'font_size',
}

// Эффективные персональные настройки вида чата (per-chat override, иначе глобальные).
export function useChatSettings(chatId: number) {
  const qc = useQueryClient()
  const [colorScope, setColorScope] = useState<'chat' | 'global'>('chat')
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['chat-settings', chatId],
    queryFn: () => chatsApi.getChatSettings(chatId),
    staleTime: 60_000,
  })

  const chatColors = useMemo<ChatColors>(() => settings ? {
    ownBubble: settings.own_bubble_color ?? undefined,
    otherBubble: settings.other_bubble_color ?? undefined,
    botBubble: settings.bot_bubble_color ?? undefined,
    ownText: settings.own_text_color ?? undefined,
    otherText: settings.other_text_color ?? undefined,
    botText: settings.bot_text_color ?? undefined,
    nickColor: settings.nick_color ?? undefined,
    fontSize: settings.font_size ?? undefined,
  } : {}, [settings])

  const wallpaper = settings?.wallpaper_id ?? 'default'
  const customWallpaperUrl = settings?.wallpaper_id === 'custom' && settings.wallpaper_url
    ? toFullUrl(settings.wallpaper_url)
    : null

  // Применить патч настроек к выбранному scope (этот чат / все чаты).
  const applySettings = useCallback(async (patch: ChatSettingsPatch) => {
    try {
      if (colorScope === 'global') {
        await chatsApi.updateGlobalSettings(patch)
        qc.invalidateQueries({ queryKey: ['chat-settings'] })
      } else {
        const updated = await chatsApi.updateChatSettings(chatId, patch)
        qc.setQueryData(['chat-settings', chatId], updated)
      }
    } catch {
      toast.error('Не удалось сохранить настройки')
    }
  }, [colorScope, chatId, qc])

  const saveColor = useCallback((key: keyof ChatColors, value: string | number | undefined) => {
    applySettings({ [COLOR_FIELD[key]]: value ?? null } as ChatSettingsPatch)
  }, [applySettings])

  // Обои — всегда per-chat override (вкладка обоев без переключателя scope).
  const saveWallpaper = useCallback(async (patch: ChatSettingsPatch) => {
    try {
      const updated = await chatsApi.updateChatSettings(chatId, patch)
      qc.setQueryData(['chat-settings', chatId], updated)
    } catch {
      toast.error('Не удалось сохранить обои')
    }
  }, [chatId, qc])

  const uploadWallpaper = useCallback(async (file: File) => {
    setUploadingWallpaper(true)
    try {
      const { url } = await chatsApi.uploadAttachment(file)
      await saveWallpaper({ wallpaper_id: 'custom', wallpaper_url: url })
    } catch {
      toast.error('Не удалось загрузить изображение')
    } finally {
      setUploadingWallpaper(false)
    }
  }, [saveWallpaper])

  return {
    chatColors, wallpaper, customWallpaperUrl, colorScope, setColorScope,
    saveColor, saveWallpaper, uploadWallpaper, uploadingWallpaper,
  }
}
