import { useRef, useState } from 'react'
import { isCancel } from 'axios'
import type { UploadOptions } from '@/lib/api/media'

// Прогресс и отмена для одной загрузки: start() выдаёт опции для mediaApi.upload*,
// cancel() обрывает запрос, isCancelled() отличает отмену от настоящей ошибки.
export function useCancellableUpload() {
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState(0)

  const start = (): UploadOptions => {
    controller.current = new AbortController()
    setProgress(0)
    return { signal: controller.current.signal, onProgress: setProgress }
  }

  const cancel = () => controller.current?.abort()

  const isCancelled = (err: unknown) => isCancel(err)

  return { progress, start, cancel, isCancelled }
}
