'use client'

import { useRef, useState } from 'react'

export interface FolderUploadResult {
  uploaded: number
  skipped: number
  failed: number
}

interface Options {
  // null — файл ок, string — причина пропуска (недопустимый формат/размер и т.п.)
  validate?: (file: File) => string | null
  upload: (file: File) => Promise<unknown>
  onDone?: (result: FolderUploadResult) => void
}

// Загрузка через выбор папки (input[type=file] с webkitdirectory) — браузер
// не даёт сайту прочитать содержимое произвольного пути на диске напрямую,
// это единственный стандартный способ "указать папку и забрать всё, что в ней".
// Бэкенд принимает только один файл за запрос (multipart, поле file), поэтому
// файлы из папки грузятся последовательно, один за другим, через тот же
// upload(), что и обычный выбор одного файла.
export function useFolderUpload({ validate, upload, onDone }: Options) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const trigger = () => inputRef.current?.click()

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    setUploading(true)
    setProgress({ done: 0, total: files.length })
    let uploaded = 0
    let skipped = 0
    let failed = 0

    for (const file of files) {
      const error = validate?.(file)
      if (error) {
        skipped++
      } else {
        try {
          await upload(file)
          uploaded++
        } catch {
          failed++
        }
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    setUploading(false)
    setProgress({ done: 0, total: 0 })
    onDone?.({ uploaded, skipped, failed })
  }

  // webkitdirectory/directory — нестандартные для React-типов JSX-атрибуты,
  // поэтому отдаём готовый объект пропсов через spread на стороне вызова
  // ({...folderInputProps}), а не пытаемся типизировать их в самом <input>.
  const folderInputProps = {
    ref: inputRef,
    type: 'file' as const,
    multiple: true,
    className: 'hidden',
    onChange: handleChange,
    webkitdirectory: '',
    directory: '',
  }

  return { uploading, progress, trigger, folderInputProps }
}
