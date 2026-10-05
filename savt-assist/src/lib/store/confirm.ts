'use client'

import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  // danger — необратимое действие: красная шапка и красная кнопка подтверждения.
  danger?: boolean
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

interface ConfirmStore {
  request: ConfirmRequest | null
  open: (opts: ConfirmOptions) => Promise<boolean>
  settle: (ok: boolean) => void
}

// Замена нативному window.confirm(): тот показывает системное окно «Сообщение с
// <адрес>», не вписывается в интерфейс и не темизируется. Окно рисует
// ConfirmHost (смонтирован в Providers), вызывать можно откуда угодно, в том
// числе из обработчиков вне React: if (await confirmDialog({...})) ...
export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  request: null,
  open: (opts) =>
    new Promise<boolean>((resolve) => {
      // Если уже висит другое подтверждение — считаем его отменённым, а не
      // оставляем «зависший» промис.
      get().request?.resolve(false)
      set({ request: { ...opts, resolve } })
    }),
  settle: (ok) => {
    const req = get().request
    if (!req) return
    set({ request: null })
    req.resolve(ok)
  },
}))

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().open(opts)
}
