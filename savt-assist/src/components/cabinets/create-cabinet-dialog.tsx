'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { CabinetTypeCombobox } from '@/components/ui/cabinet-type-combobox'
import { cabinetsApi, CreateCabinetDto } from '@/lib/api/cabinets'
import { LocationPicker } from '@/components/map/location-picker'

interface Props {
  open: boolean
  onClose: () => void
}

type FormErrors = Partial<Record<keyof CreateCabinetDto, string>>

const EMPTY: CreateCabinetDto = {
  type: '',
  object_number: '',
  admin_internal_name: '',
  description: '',
  purpose: '',
  admin_comment: '',
  warranty_starts_at: '',
  warranty_ends_at: '',
  latitude: null,
  longitude: null,
}

function validate(form: CreateCabinetDto): FormErrors {
  const e: FormErrors = {}
  if (!form.type.trim()) e.type = 'Обязательное поле'
  if (!form.object_number.trim()) e.object_number = 'Обязательное поле'
  if (form.warranty_starts_at && form.warranty_ends_at) {
    if (new Date(form.warranty_ends_at) < new Date(form.warranty_starts_at)) {
      e.warranty_ends_at = 'Не может быть раньше даты начала'
    }
  }
  return e
}

export function CreateCabinetDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateCabinetDto>(EMPTY)
  const [errors, setErrors] = useState<FormErrors>({})

  const clearError = (key: keyof CreateCabinetDto) =>
    setErrors(prev => ({ ...prev, [key]: undefined }))

  const mutation = useMutation({
    mutationFn: () =>
      cabinetsApi.create({
        type: form.type,
        object_number: form.object_number,
        admin_internal_name: form.admin_internal_name || null,
        description: form.description || null,
        purpose: form.purpose || null,
        admin_comment: form.admin_comment || null,
        warranty_starts_at: form.warranty_starts_at
          ? new Date(form.warranty_starts_at).toISOString()
          : null,
        warranty_ends_at: form.warranty_ends_at
          ? new Date(form.warranty_ends_at).toISOString()
          : null,
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('ШУ успешно создан')
      setForm(EMPTY)
      setErrors({})
      onClose()
    },
    onError: () => toast.error('Не удалось создать ШУ'),
  })

  const set = (key: keyof CreateCabinetDto) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }))
      clearError(key)
    }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    mutation.mutate()
  }

  const handleClose = () => {
    setForm(EMPTY)
    setErrors({})
    onClose()
  }

  return (
    <AppModal open={open} onClose={handleClose} className="sm:max-w-2xl">
      <div className="flex flex-col max-h-[85vh]">

        {/* Gradient header */}
        <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5 shrink-0">
          <div className="flex items-start gap-4 pr-8">
            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
              <CabinetIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg text-white leading-tight">Добавить ШУ</p>
              <p className="text-sm text-white/60 mt-0.5">Заполните данные нового шкафа управления</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn('text-xs font-medium block mb-1.5', errors.type ? 'text-red-500' : 'text-slate-500')}>
                  Тип ШУ <span className="text-red-500">*</span>
                </label>
                <CabinetTypeCombobox
                  value={form.type}
                  onChange={v => { setForm(prev => ({ ...prev, type: v })); clearError('type') }}
                  error={errors.type}
                />
                {errors.type && <p className="text-xs text-red-500 mt-1">{errors.type}</p>}
              </div>
              <Field
                label="Номер объекта *"
                value={form.object_number}
                onChange={set('object_number')}
                placeholder="29_099"
                error={errors.object_number}
              />
            </div>

            <Field
              label="Внутреннее название"
              value={form.admin_internal_name ?? ''}
              onChange={set('admin_internal_name')}
              placeholder="ШУ-18К"
            />

            <Field
              label="Описание"
              value={form.description ?? ''}
              onChange={set('description')}
              placeholder="Краткое описание шкафа"
              multiline
            />

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Назначение"
                value={form.purpose ?? ''}
                onChange={set('purpose')}
                placeholder="Управление освещением..."
              />
              <Field
                label="Комментарий администратора"
                value={form.admin_comment ?? ''}
                onChange={set('admin_comment')}
                placeholder="Внутренний комментарий"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Гарантия с"
                value={form.warranty_starts_at ?? ''}
                onChange={set('warranty_starts_at')}
                type="date"
              />
              <Field
                label="Гарантия до"
                value={form.warranty_ends_at ?? ''}
                onChange={set('warranty_ends_at')}
                type="date"
                error={errors.warranty_ends_at}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1.5">Местоположение</label>
              <LocationPicker
                value={form.latitude != null && form.longitude != null
                  ? { lat: form.latitude, lng: form.longitude }
                  : null}
                onChange={val => setForm(prev => ({
                  ...prev,
                  latitude: val ? val.lat : null,
                  longitude: val ? val.lng : null,
                }))}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={mutation.isPending} className="cursor-pointer">
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer"
            >
              {mutation.isPending ? 'Создание...' : 'Добавить'}
            </Button>
          </div>
        </form>

      </div>
    </AppModal>
  )
}

function Field({
  label, value, onChange, placeholder, multiline, error, type = 'text',
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  multiline?: boolean
  error?: string
  type?: string
}) {
  const base = cn(
    'w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none placeholder:text-slate-400',
    error
      ? 'border-red-400 focus:border-red-500 dark:border-red-500'
      : 'border-slate-200 dark:border-slate-600 focus:border-[#4A8FE7]'
  )
  return (
    <div>
      <label className={cn('text-xs font-medium block mb-1.5', error ? 'text-red-500' : 'text-slate-500')}>
        {label}
      </label>
      {multiline ? (
        <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2} className={cn(base, 'resize-none')} />
      ) : (
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} className={base} />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function CabinetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 003 3h10.5a3 3 0 003-3m-16.5 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v8.25m-3 0V6a2.25 2.25 0 00-2.25-2.25H8.25A2.25 2.25 0 006 6v8.25m6 3v-3" />
    </svg>
  )
}
