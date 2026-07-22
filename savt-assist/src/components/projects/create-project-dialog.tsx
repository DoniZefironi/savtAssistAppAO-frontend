'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { projectsApi } from '@/lib/api/projects'

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateProjectDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()

  const mutation = useMutation({
    mutationFn: () => projectsApi.create(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Проект создан')
      setName('')
      onClose()
    },
    onError: () => toast.error('Не удалось создать проект'),
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) { setError('Обязательное поле'); return }
    setError(undefined)
    mutation.mutate()
  }

  const handleClose = () => {
    setName('')
    setError(undefined)
    onClose()
  }

  return (
    <AppModal open={open} onClose={handleClose}>
      <div className="flex flex-col min-w-0">
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5 shrink-0">
          <div className="flex items-start gap-3 sm:gap-4 pr-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <FolderIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-white leading-tight">Добавить проект</p>
              <p className="text-sm text-white/60 mt-0.5">Группа шкафов с общим QR-кодом</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-5 space-y-4">
          <div>
            <label className={cn('text-xs font-medium block mb-1.5', error ? 'text-red-500' : 'text-slate-500')}>
              Название <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setError(undefined) }}
              placeholder="Бизнес-центр Космос"
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400',
                error ? 'border-red-400 focus:border-red-500 dark:border-red-500' : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
              )}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={mutation.isPending} className="cursor-pointer">
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
              {mutation.isPending ? 'Создание...' : 'Добавить'}
            </Button>
          </div>
        </form>
      </div>
    </AppModal>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 015.25 3.75h5.379a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18.75A2.25 2.25 0 0121 9v.776" />
    </svg>
  )
}
