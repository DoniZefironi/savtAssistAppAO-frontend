'use client'

import { useEffect, useRef } from 'react'

interface Options {
  hasNextPage: boolean | undefined
  isFetchingNextPage: boolean
  // Последняя попытка fetchNextPage() упала с ошибкой (429 и т.п.) — не
  // подгружаем автоматически дальше, ждём явного повторного триггера
  // (обычно кнопки "Повторить"), см. комментарий у хука ниже.
  isFetchNextPageError?: boolean
  fetchNextPage: () => void
  // Меняется (по ссылке) при каждой УСПЕШНОЙ подгрузке страницы — react-query
  // отдаёт новый объект data на каждый success, тот же на error. Нужен, чтобы
  // после пустой (отфильтрованной сервером) страницы можно было безопасно
  // продолжить сразу, если сентинел всё ещё виден, не дожидаясь скролла.
  data: unknown
  rootMargin?: string
}

// Безопасный IntersectionObserver для infinite-scroll пагинации (React Query
// useInfiniteQuery). См. разбор реального инцидента: 429 на одной странице
// истории телеметрии запустил бесконечный цикл повторов без единой паузы.
//
// Причина типичной (и часто встречающейся в этом проекте) ошибки — создавать
// IntersectionObserver в эффекте с зависимостями
// [hasNextPage, isFetchingNextPage, fetchNextPage]. По спецификации при
// каждом (пере)вызове .observe() браузер обязан один раз асинхронно вызвать
// колбэк с ТЕКУЩИМ состоянием пересечения — то есть каждое пересоздание
// эквивалентно ещё одному "срабатыванию" безо всякого реального скролла.
// Пока сентинел не двигается (например, страница упала с ошибкой и список не
// вырос), isFetchingNextPage гоняется false→true→false на каждую попытку,
// эффект пересоздаёт observer на каждый такой переход, и та же самая
// страница долбится заново без всякой задержки — сам себя такой цикл
// остановить не может, даже когда причина первой ошибки давно прошла.
//
// Здесь observer создаётся ровно один раз (пустой список зависимостей), а
// актуальные hasNextPage/isFetchingNextPage/isFetchNextPageError колбэк
// читает через рефы — значит по-настоящему срабатывает только на реальные
// пересечения (скролл, изменение размеров контента), а не на каждый чих
// состояния запроса. После успешной подгрузки (data изменился) отдельно
// проверяем: если сентинел всё ещё в зоне видимости — продолжаем сами
// (нужно, когда сервер фильтрует часть строк и одна "страница" не заполняет
// видимую область целиком).
export function useInfiniteScrollSentinel(
  sentinelRef: React.RefObject<HTMLElement | null>,
  { hasNextPage, isFetchingNextPage, isFetchNextPageError = false, fetchNextPage, data, rootMargin = '200px' }: Options,
  containerRef?: React.RefObject<HTMLElement | null>
) {
  const hasNextPageRef = useRef(hasNextPage)
  const isFetchingNextPageRef = useRef(isFetchingNextPage)
  const isFetchNextPageErrorRef = useRef(isFetchNextPageError)
  const fetchNextPageRef = useRef(fetchNextPage)
  const isIntersectingRef = useRef(false)

  useEffect(() => {
    hasNextPageRef.current = hasNextPage
    isFetchingNextPageRef.current = isFetchingNextPage
    isFetchNextPageErrorRef.current = isFetchNextPageError
    fetchNextPageRef.current = fetchNextPage
  })

  const maybeFetch = () => {
    if (!hasNextPageRef.current || isFetchingNextPageRef.current || isFetchNextPageErrorRef.current) return
    fetchNextPageRef.current()
  }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        isIntersectingRef.current = entry.isIntersecting
        if (entry.isIntersecting) maybeFetch()
      },
      { root: containerRef?.current ?? null, rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // На ошибке data не меняется (react-query оставляет предыдущее успешное
  // значение) — этот эффект просто не перезапустится, и цикл не сможет
  // самоподдерживаться.
  useEffect(() => {
    if (data === undefined) return
    if (isIntersectingRef.current) maybeFetch()
  }, [data])
}
