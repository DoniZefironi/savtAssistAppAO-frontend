'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Закрытие по клику вне области — раньше один и тот же mousedown-listener
 * с проверкой ref.contains копировался в каждый комбобокс/дропдаун отдельно.
 *
 * onOutside берётся всегда свежим через ref (как onChangeRef в других местах
 * проекта) — можно передавать инлайн-стрелку, не оборачивая в useCallback.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[],
  onOutside: () => void,
  active = true,
) {
  const onOutsideRef = useRef(onOutside)
  useEffect(() => { onOutsideRef.current = onOutside })

  useEffect(() => {
    if (!active) return
    const list = Array.isArray(refs) ? refs : [refs]
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!list.some(r => r.current?.contains(target))) onOutsideRef.current()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
}
