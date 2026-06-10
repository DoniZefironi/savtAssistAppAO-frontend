'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CabinetTypeCombobox } from '@/components/ui/cabinet-type-combobox'
import { cabinetsApi, CreateCabinetDto } from '@/lib/api/cabinets'
import { cn } from '@/lib/utils'

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
    setErrors((prev) => ({ ...prev, [key]: undefined }))

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

  const set = (key: keyof CreateCabinetDto) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    clearError(key)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    mutation.mutate()
  }

  const handleClose = () => {
    setForm(EMPTY)
    setErrors({})
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Добавить ШУ</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={cn('text-sm', errors.type ? 'text-destructive' : 'text-slate-600')}>
                Тип ШУ *
              </Label>
              <CabinetTypeCombobox
                value={form.type}
                onChange={(v) => {
                  setForm((prev) => ({ ...prev, type: v }))
                  clearError('type')
                }}
                error={errors.type}
              />
              {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
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
            placeholder="Краткое описание"
            multiline
          />
          <Field
            label="Назначение"
            value={form.purpose ?? ''}
            onChange={set('purpose')}
            placeholder="Управление..."
          />
          <Field
            label="Комментарий"
            value={form.admin_comment ?? ''}
            onChange={set('admin_comment')}
            placeholder="Внутренний комментарий"
            multiline
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-600 text-sm">Гарантия с</Label>
              <Input type="date" value={form.warranty_starts_at ?? ''} onChange={set('warranty_starts_at')} />
            </div>
            <div className="space-y-1.5">
              <Label className={cn('text-sm', errors.warranty_ends_at ? 'text-destructive' : 'text-slate-600')}>
                Гарантия до
              </Label>
              <Input
                type="date"
                value={form.warranty_ends_at ?? ''}
                onChange={set('warranty_ends_at')}
                aria-invalid={!!errors.warranty_ends_at}
              />
              {errors.warranty_ends_at && (
                <p className="text-xs text-destructive">{errors.warranty_ends_at}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={mutation.isPending} className="cursor-pointer">
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer">
              {mutation.isPending ? 'Создание...' : 'Добавить'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label, value, onChange, placeholder, multiline, error,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder?: string
  multiline?: boolean
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className={cn('text-sm', error ? 'text-destructive' : 'text-slate-600')}>{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={2}
          className={cn(
            'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none resize-none placeholder:text-slate-300 transition-colors',
            error
              ? 'border-destructive focus:border-destructive'
              : 'border-slate-200 focus:border-blue-400'
          )}
        />
      ) : (
        <Input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-invalid={!!error}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
