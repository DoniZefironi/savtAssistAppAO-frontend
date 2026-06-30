'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

/**
 * Состояние, синхронизируемое с localStorage.
 *
 * Первый рендер всегда отдаёт `defaultValue` (совпадает с SSR), а сохранённое
 * значение подтягивается из localStorage уже после монтирования — поэтому нет
 * hydration mismatch. Изменения сохраняются автоматически с лёгким дебаунсом,
 * чтобы частые апдейты (например, перетаскивание ширины панели) не писали в
 * storage на каждый кадр.
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(defaultValue)

  // подтянуть сохранённое после монтирования
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch { /* битый JSON / недоступный storage — остаёмся на defaultValue */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // сохранять при изменениях (пропускаем первый проход, чтобы не перезаписать
  // сохранённое значение значением по умолчанию до загрузки)
  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    const t = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage недоступен */ }
    }, 150)
    return () => clearTimeout(t)
  }, [key, value])

  return [value, setValue]
}
