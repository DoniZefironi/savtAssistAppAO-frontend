'use client'

import { create } from 'zustand'

interface ModalEntry {
  id: string
  onClose: () => void
}

interface ModalStackStore {
  stack: ModalEntry[]
  register: (id: string, onClose: () => void) => void
  unregister: (id: string) => void
  bringToFront: (id: string) => void
  closeTop: () => void
}

// Общий стек открытых AppModal — держит порядок наложения (z-order) и общий
// затемняющий фон на все окна разом, а не по одному на модалку: так несколько
// окон можно двигать и видеть друг друга одновременно, как в Windows, вместо
// прежнего "одно окно — свой полноэкранный оверлей". Закрытие родителя
// закрывает и вложенные окна (стандартное поведение) — оно и так происходит
// само собой, т.к. вложенное окно физически рендерится внутри содержимого
// родителя и размонтируется вместе с ним, без какой-либо особой логики здесь.
export const useModalStackStore = create<ModalStackStore>((set, get) => ({
  stack: [],
  register: (id, onClose) =>
    set((s) => (s.stack.some((e) => e.id === id) ? s : { stack: [...s.stack, { id, onClose }] })),
  unregister: (id) => set((s) => ({ stack: s.stack.filter((e) => e.id !== id) })),
  bringToFront: (id) =>
    set((s) => {
      if (s.stack.length === 0 || s.stack[s.stack.length - 1].id === id) return s
      const entry = s.stack.find((e) => e.id === id)
      if (!entry) return s
      return { stack: [...s.stack.filter((e) => e.id !== id), entry] }
    }),
  closeTop: () => {
    const top = get().stack[get().stack.length - 1]
    top?.onClose()
  },
}))
