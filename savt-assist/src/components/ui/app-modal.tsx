'use client'

import { Component, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useModalStackStore } from '@/lib/store/modal-stack'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

// В приложении нет ни одного error.tsx/error boundary (см. src/app) — без
// своей границы ошибка при рендере/размонтировании ЛЮБОГО содержимого модалки
// (например, у Leaflet-карты в cabinet-detail-dialog.tsx при переключении
// вкладки) сносит всё дерево React целиком: раз все AppModal рендерятся через
// портал, но остаются частью одного и того же дерева, это закрывало бы разом
// вообще все открытые окна, а не только то, где произошла ошибка.
class ModalErrorBoundary extends Component<{ onClose: () => void; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-300">Не удалось отобразить окно.</p>
          <button
            onClick={this.props.onClose}
            className="mt-3 text-sm text-[#1B3A72] dark:text-blue-400 hover:underline cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Высота "хватательной" зоны у верха окна — под неё обычно попадает цветная
// шапка модалок (см. kb-view.tsx/service-dialog.tsx и т.д.), но она работает
// и без неё: у простых модалок-подтверждений это просто верхний отступ с
// заголовком. Единая эвристика вместо правки заголовка в каждой из ~15 модалок.
const DRAG_BAND = 64
const NO_DRAG_SELECTOR = 'button, a, input, textarea, select, [role="button"], [data-no-drag]'

export function AppModal({ open, onClose, children, className }: Props) {
  const id = useId()
  const stack = useModalStackStore((s) => s.stack)
  const register = useModalStackStore((s) => s.register)
  const unregister = useModalStackStore((s) => s.unregister)
  const bringToFront = useModalStackStore((s) => s.bringToFront)

  const boxRef = useRef<HTMLDivElement>(null)
  // null = ещё не двигали, окно центрируется чистым CSS (translate -50%/-50%).
  // Специально не сбрасывается при повторном открытии одного и того же
  // компонента (open={bool} без размонтирования) — окно остаётся там, куда
  // его перетащили в прошлый раз, как обычно ведут себя окна в ОС.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number; w: number } | null>(null)

  useEffect(() => {
    if (!open) return
    register(id, onClose)
    return () => unregister(id)
    // onClose намеренно не в зависимостях — регистрируем один раз на "открытие",
    // а не на каждый ре-рендер родителя с новым onClose-замыканием.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id])

  // Pointer Capture, а не слушатели на window: без захвата pointerup,
  // "проглоченный" чужим обработчиком (например, Leaflet-карта в вкладке
  // "Информация" шкафа сама останавливает всплытие своих pointer-событий),
  // никогда не снял бы window-слушатели — движение курсора где угодно на
  // странице после этого продолжало бы двигать чужое, давно отпущенное окно.
  // С захватом события гарантированно приходят именно в box, что бы ни было
  // под курсором.
  const handlePointerDown = (e: React.PointerEvent) => {
    // Порталы React всплывают по дереву компонентов, а не по DOM: клик по
    // вложенной модалке (например, редактирование фото поверх окна шкафа)
    // иначе доходил бы и до onPointerDown внешнего окна тоже, хотя в DOM это
    // просто два независимых соседних элемента document.body — внешнее окно
    // "захватывалось" бы вместе с вложенным без прямого клика по нему.
    e.stopPropagation()
    bringToFront(id)
    const target = e.target as HTMLElement
    if (target.closest(NO_DRAG_SELECTOR)) return
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    if (e.clientY - rect.top > DRAG_BAND) return

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      w: box.offsetWidth,
    }
    box.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    e.stopPropagation()
    const nx = Math.min(Math.max(d.origX + (e.clientX - d.startX), 160 - d.w), window.innerWidth - 160)
    const ny = Math.min(Math.max(d.origY + (e.clientY - d.startY), 0), window.innerHeight - 48)
    setPos({ x: nx, y: ny })
  }

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (dragRef.current?.pointerId !== e.pointerId) return
    e.stopPropagation()
    dragRef.current = null
    boxRef.current?.releasePointerCapture(e.pointerId)
  }

  if (!open || typeof document === 'undefined') return null

  const idx = Math.max(stack.findIndex((e) => e.id === id), 0)
  const zIndex = 1200 + idx * 10
  // Каскад для ещё не двинутых окон: без него все свежеоткрытые модалки садятся
  // ровно друг на друга (совпадающие крестики закрытия и т.д.) — по клику
  // непонятно, какое окно реально под курсором.
  const cascade = idx * 24

  return createPortal(
    <div
      ref={boxRef}
      role="dialog"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{
        position: 'fixed',
        zIndex,
        ...(pos
          ? { top: pos.y, left: pos.x }
          : { top: `calc(50% + ${cascade}px)`, left: `calc(50% + ${cascade}px)`, transform: 'translate(-50%, -50%)' }),
      }}
      className={cn(
        // grid — как у прежнего Popup из base-ui: без него дочерний контент
        // (напр. min-w-0 в cabinet-detail-dialog.tsx) не сжимался бы ниже
        // ширины своего содержимого и вылезал бы за рамки окна.
        'grid w-full max-w-[calc(100%-2rem)] sm:max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100',
        className
      )}
    >
      <ModalErrorBoundary onClose={onClose}>{children}</ModalErrorBoundary>
      {/* stopPropagation — та же причина, что у onPointerDown выше: клик по
          крестику вложенной модалки иначе всплыл бы по дереву React и до
          крестика модалки-предка, хотя в DOM это просто соседние элементы.
          Закрытие родителя закрывает и вложенное окно вместе с собой —
          так и задумано (стандартное поведение), см. modal-stack.ts. */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        data-no-drag
        className="absolute top-3 right-3 z-10 w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>,
    document.body
  )
}

// Один общий затемняющий фон на весь стек модалок — монтируется один раз в
// Providers, а не в каждой AppModal, иначе при нескольких открытых окнах
// они бы взаимно перекрывали друг друга своими собственными оверлеями.
export function ModalBackdrop() {
  const count = useModalStackStore((s) => s.stack.length)
  const closeTop = useModalStackStore((s) => s.closeTop)

  useEffect(() => {
    if (count === 0) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTop()
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handler)
    }
  }, [count, closeTop])

  if (count === 0 || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1150] bg-black/10 supports-backdrop-filter:backdrop-blur-xs animate-in fade-in-0 duration-100"
      onClick={closeTop}
    />,
    document.body
  )
}
