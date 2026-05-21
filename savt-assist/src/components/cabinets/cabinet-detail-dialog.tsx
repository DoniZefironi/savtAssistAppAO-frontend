'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WarrantyBadge } from './warranty-badge'
import { cabinetsApi, UpdateCabinetDto } from '@/lib/api/cabinets'
import { formatDate } from '@/lib/warranty'
import type { Cabinet } from '@/types'

interface Props {
  cabinetId: number | null
  isAdmin: boolean
  initialMode?: 'view' | 'edit'
  onClose: () => void
}

export function CabinetDetailDialog({ cabinetId, isAdmin, initialMode = 'view', onClose }: Props) {
  return (
    <Dialog open={cabinetId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        {cabinetId !== null && (
          <DetailContent
            cabinetId={cabinetId}
            isAdmin={isAdmin}
            initialMode={initialMode}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailContent({ cabinetId, isAdmin, initialMode, onClose }: {
  cabinetId: number
  isAdmin: boolean
  initialMode: 'view' | 'edit'
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(initialMode === 'edit')
  const [fields, setFields] = useState<FormFields | null>(null)

  const { data: cabinet, isLoading } = useQuery({
    queryKey: ['cabinet', cabinetId],
    queryFn: () => cabinetsApi.getOne(cabinetId),
  })

  // Init form when cabinet loads or dialog reopens
  useEffect(() => {
    if (cabinet) setFields(cabinetToFields(cabinet))
    setEditing(initialMode === 'edit')
  }, [cabinet, initialMode])

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateCabinetDto) => cabinetsApi.update(cabinetId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      qc.invalidateQueries({ queryKey: ['cabinet', cabinetId] })
      toast.success('Изменения сохранены')
      setEditing(false)
    },
    onError: () => toast.error('Не удалось сохранить'),
  })

  const handleSave = () => {
    if (!fields) return
    updateMutation.mutate(fieldsToDto(fields))
  }

  const handleCancel = () => {
    if (cabinet) setFields(cabinetToFields(cabinet))
    setEditing(false)
  }

  if (isLoading || !fields || !cabinet) {
    return <DetailSkeleton />
  }

  const set = (key: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFields((p) => p ? { ...p, [key]: e.target.value } : p)

  return (
    <div className="flex flex-col">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5">
        <div className="flex items-start gap-4 pr-2">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
            <BoardIcon className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <>
                <input
                  value={fields.admin_internal_name}
                  onChange={set('admin_internal_name')}
                  placeholder="Внутреннее название"
                  className="w-full font-bold text-lg text-white bg-transparent border-b border-white/30 focus:border-white outline-none placeholder:text-white/30 pb-0.5 leading-tight"
                />
                <input
                  value={fields.object_number}
                  onChange={set('object_number')}
                  placeholder="Номер объекта"
                  className="w-full text-sm text-white/60 bg-transparent border-b border-white/20 focus:border-white/50 outline-none placeholder:text-white/20 mt-1.5"
                />
              </>
            ) : (
              <>
                <p className="font-bold text-lg text-white leading-tight truncate">
                  {fields.admin_internal_name || fields.object_number}
                </p>
                <p className="text-sm text-white/60 mt-0.5">{fields.object_number}</p>
              </>
            )}
            <div className="mt-2">
              <WarrantyBadge warrantyEndsAt={fields.warranty_end ? new Date(fields.warranty_end).toISOString() : null} />
            </div>
          </div>

          {/* Pencil — only in view mode, only admin */}
          {!editing && isAdmin && (
            <button
              onClick={() => setEditing(true)}
              title="Редактировать"
              className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <PencilIcon className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* ── Fields ── */}
      <div className="px-6 py-4 space-y-0 divide-y divide-slate-50">
        <DetailRow
          label="Тип"
          value={fields.type}
          editing={editing}
          onChange={set('type')}
          placeholder="Добавить тип"
        />
        <DetailRow
          label="Описание"
          value={fields.description}
          editing={editing}
          onChange={set('description')}
          placeholder="Добавить описание"
          multiline
        />
        <DetailRow
          label="Назначение"
          value={fields.purpose}
          editing={editing}
          onChange={set('purpose')}
          placeholder="Добавить назначение"
        />
        <DetailRow
          label="Комментарий"
          value={fields.admin_comment}
          editing={editing}
          onChange={set('admin_comment')}
          placeholder="Добавить комментарий"
          multiline
        />
        <DateRow
          label="Гарантия с"
          value={fields.warranty_start}
          editing={editing}
          onChange={(v) => setFields((p) => p ? { ...p, warranty_start: v } : p)}
        />
        <DateRow
          label="Гарантия до"
          value={fields.warranty_end}
          editing={editing}
          onChange={(v) => setFields((p) => p ? { ...p, warranty_end: v } : p)}
        />
      </div>

      {/* ── Footer ── */}
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
        {editing ? (
          <>
            <Button variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-[#1B3A72] hover:bg-[#1B3A72]/90"
            >
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        )}
      </div>
    </div>
  )
}

// ─── Shared row components ────────────────────────────────────────────────────

function DetailRow({ label, value, editing, onChange, placeholder, multiline }: {
  label: string
  value: string
  editing: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder: string
  multiline?: boolean
}) {
  const isEmpty = !value.trim()
  return (
    <div className="flex gap-4 py-3">
      <span className="text-xs text-slate-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={2}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-200 focus:border-[#4A8FE7] outline-none placeholder:text-slate-300 placeholder:italic resize-none py-0"
          />
        ) : (
          <input
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="flex-1 text-sm text-slate-700 bg-transparent border-b border-slate-200 focus:border-[#4A8FE7] outline-none placeholder:text-slate-300 placeholder:italic"
          />
        )
      ) : (
        <span className={`flex-1 text-sm ${isEmpty ? 'text-slate-300 italic' : 'text-slate-700 font-medium'}`}>
          {isEmpty ? placeholder : value}
        </span>
      )}
    </div>
  )
}

function DateRow({ label, value, editing, onChange }: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
}) {
  const display = value ? formatDate(new Date(value).toISOString()) : ''
  return (
    <div className="flex gap-4 py-3">
      <span className="text-xs text-slate-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      {editing ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm text-slate-700 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-[#4A8FE7]"
        />
      ) : (
        <span className={`text-sm ${display ? 'text-slate-700 font-medium' : 'text-slate-300 italic'}`}>
          {display || 'Не указана'}
        </span>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FormFields {
  admin_internal_name: string
  object_number: string
  type: string
  description: string
  purpose: string
  admin_comment: string
  warranty_start: string
  warranty_end: string
}

function cabinetToFields(c: Cabinet): FormFields {
  return {
    admin_internal_name: c.admin_internal_name ?? '',
    object_number: c.object_number,
    type: c.type ?? '',
    description: c.description ?? '',
    purpose: c.purpose ?? '',
    admin_comment: c.admin_comment ?? '',
    warranty_start: c.warranty_starts_at?.slice(0, 10) ?? '',
    warranty_end: c.warranty_ends_at?.slice(0, 10) ?? '',
  }
}

function fieldsToDto(f: FormFields): UpdateCabinetDto {
  return {
    admin_internal_name: f.admin_internal_name || null,
    object_number: f.object_number || undefined,
    type: f.type || null,
    description: f.description || null,
    purpose: f.purpose || null,
    admin_comment: f.admin_comment || null,
    warranty_starts_at: f.warranty_start ? new Date(f.warranty_start).toISOString() : null,
    warranty_ends_at: f.warranty_end ? new Date(f.warranty_end).toISOString() : null,
  }
}

function DetailSkeleton() {
  return (
    <div>
      <div className="bg-gradient-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl bg-white/20" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-40 bg-white/20" />
            <Skeleton className="h-3 w-24 bg-white/20" />
          </div>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-3 w-24 flex-shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}
