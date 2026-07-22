'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectCombobox } from '@/components/ui/project-combobox'
import { WarrantyBadge } from './warranty-badge'
import { cabinetsApi, UpdateCabinetDto } from '@/lib/api/cabinets'
import { kbApi } from '@/lib/api/kb'
import type { Tag } from '@/lib/api/tags'
import { formatDate } from '@/lib/warranty'
import { cn } from '@/lib/utils'
import type { Cabinet } from '@/types'
import { LocationPicker } from '@/components/map/location-picker'
import { useAuthStore } from '@/lib/store/auth'
import { DocsTab } from './cabinet-docs-tab'
import { PhotosTab } from './cabinet-photos-tab'
import { UsersTab } from './cabinet-users-tab'
import { ServiceRequestsTab } from './cabinet-requests-tab'
import { BoardIcon, PencilIcon } from './cabinet-dialog-icons'

type Tab = 'info' | 'docs' | 'photos' | 'users' | 'requests'

interface Props {
  cabinetId: number | null
  isAdmin?: boolean
  initialMode?: 'view' | 'edit'
  onClose: () => void
}

export function CabinetDetailDialog({ cabinetId, initialMode = 'view', onClose }: Props) {
  return (
    <AppModal open={cabinetId !== null} onClose={onClose}>
      {cabinetId !== null && (
        <DetailContent
          cabinetId={cabinetId}
          initialMode={initialMode}
        />
      )}
    </AppModal>
  )
}

function DetailContent({ cabinetId, initialMode }: {
  cabinetId: number
  initialMode: 'view' | 'edit'
}) {
  const currentUser = useAuthStore(s => s.user)
  const isAdmin = currentUser?.role !== 'operator'
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('info')
  const [editing, setEditing] = useState(initialMode === 'edit')
  const [fields, setFields] = useState<FormFields | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})

  const { data: cabinet, isLoading } = useQuery({
    queryKey: ['cabinet', cabinetId],
    queryFn: () => cabinetsApi.getOne(cabinetId),
  })

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
    const errs = validate(fields)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    updateMutation.mutate(fieldsToDto(fields))
  }

  const handleCancel = () => {
    if (cabinet) setFields(cabinetToFields(cabinet))
    setErrors({})
    setEditing(false)
  }

  const handleTabChange = (t: Tab) => {
    if (editing) handleCancel()
    setTab(t)
  }

  if (isLoading || !fields || !cabinet) {
    return <DetailSkeleton />
  }

  const set = (key: keyof FormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((p) => p ? { ...p, [key]: e.target.value } : p)
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Информация' },
    { id: 'docs', label: 'Документы' },
    { id: 'photos', label: 'Фото' },
    { id: 'users', label: 'Пользователи' },
    { id: 'requests', label: 'Заявки' },
  ]

  // min-w-0 ниже — Popup из @base-ui/react/dialog это display:grid, а у grid-элементов
  // по умолчанию min-width:auto: без явного min-w-0 этот блок не сжимается уже по
  // ширине контента (напр. нескроллящиеся whitespace-nowrap табы), из-за чего весь
  // блок вылезает шире модалки и обрезается overflow-hidden — та же природа бага,
  // что была с min-h-0 (см. комментарий у overflow-y-auto ниже).
  return (
    <div className="flex flex-col max-h-[85vh] min-w-0">
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-4 sm:px-6 py-4 sm:py-5 shrink-0">
        {/* pr-8 (не pr-2) — иначе на узких экранах длинное название ШУ в режиме
            редактирования (input на всю ширину, без truncate) налезает на крестик
            закрытия (absolute right-3, w-7 ≈ 40px). Тот же паттерн уже в create-cabinet-dialog.tsx */}
        <div className="flex items-start gap-3 sm:gap-4 pr-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/15 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
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
                  className={cn(
                    'w-full text-sm text-white/60 bg-transparent border-b outline-none placeholder:text-white/20 mt-1.5',
                    errors.object_number ? 'border-red-300 focus:border-red-300' : 'border-white/20 focus:border-white/50'
                  )}
                />
                {errors.object_number && <p className="text-xs text-red-200 mt-0.5">{errors.object_number}</p>}
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
        </div>
      </div>

      {/* Не переносится (сломает вид подчёркнутой навигации) — на узкой модалке скроллится горизонтально */}
      <div className="flex border-b border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={cn(
              'px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap',
              tab === t.id
                ? 'border-[#1B3A72] text-[#1B3A72] dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* min-h-0 обязателен — без него flex-1 не сжимается ниже своего контента
          (дефолтный min-height: auto у flex-элементов), и вместо внутреннего скролла
          вся модалка вылезала за max-h-[85vh] и обрезалась overflow-hidden в AppModal.
          Особенно заметно в режиме редактирования: LocationRow добавляет на вкладке
          ~250px карты, которые раньше в узких/невысоких окнах некуда было скроллить. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'info' && (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
            <DetailRow label="Тип" value={fields.type} editing={editing} onChange={set('type')} placeholder="Добавить тип" error={errors.type} />
            <DetailRow label="Описание" value={fields.description} editing={editing} onChange={set('description')} placeholder="Добавить описание" multiline />
            <DetailRow label="Назначение" value={fields.purpose} editing={editing} onChange={set('purpose')} placeholder="Добавить назначение" />
            <DetailRow label="Комментарий" value={fields.admin_comment} editing={editing} onChange={set('admin_comment')} placeholder="Добавить комментарий" multiline />
            <DateRow label="Гарантия с" value={fields.warranty_start} editing={editing} onChange={(v) => { setFields((p) => p ? { ...p, warranty_start: v } : p); setErrors((prev) => ({ ...prev, warranty_start: undefined })) }} />
            <DateRow label="Гарантия до" value={fields.warranty_end} editing={editing} onChange={(v) => { setFields((p) => p ? { ...p, warranty_end: v } : p); setErrors((prev) => ({ ...prev, warranty_end: undefined })) }} error={errors.warranty_end} />
            <LocationRow
              lat={fields.latitude}
              lng={fields.longitude}
              editing={editing}
              onChange={(lat, lng) => setFields((p) => p ? { ...p, latitude: lat, longitude: lng } : p)}
            />
            <CabinetProjectRow cabinetId={cabinetId} cabinet={cabinet} isAdmin={isAdmin} />
          </div>
        )}
        {tab === 'docs' && <DocsTab cabinetId={cabinetId} isAdmin={isAdmin} />}
        {tab === 'photos' && <PhotosTab cabinetId={cabinetId} isAdmin={isAdmin} />}
        {tab === 'users' && <UsersTab cabinetId={cabinetId} isAdmin={isAdmin} />}
        {tab === 'requests' && <ServiceRequestsTab cabinetId={cabinetId} />}
      </div>

      {tab === 'info' && (
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 shrink-0">
          {!editing && isAdmin && (
            <button
              onClick={() => setEditing(true)}
              title="Редактировать"
              className="w-8 h-8 rounded-lg bg-blue/15 hover:bg-blue/25 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <PencilIcon className="w-4 h-4 text-blue" />
            </button>
          )}
          {editing && (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending} className="cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, editing, onChange, placeholder, multiline, error }: {
  label: string
  value: string
  editing: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  placeholder: string
  multiline?: boolean
  error?: string
}) {
  const isEmpty = !value.trim()
  const fieldClass = cn(
    'w-full text-sm text-slate-700 dark:text-slate-400 bg-transparent border-b outline-none placeholder:text-slate-300 placeholder:italic',
    error ? 'border-red-400 focus:border-red-500 dark:border-red-500' : 'border-slate-200 focus:border-[#4A8FE7]'
  )
  return (
    // На мобильном лейбл над значением — «Местоположение»/длинные лейблы иначе переносились
    // посреди слова при фикс. ширине колонки
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3">
      <span className="text-xs text-slate-400 sm:w-28 shrink-0 sm:pt-0.5">{label}</span>
      {editing ? (
        <div className="flex-1 min-w-0">
          {multiline ? (
            <textarea value={value} onChange={onChange} placeholder={placeholder} rows={2} className={cn(fieldClass, 'resize-none py-0')} />
          ) : (
            <input value={value} onChange={onChange} placeholder={placeholder} className={fieldClass} />
          )}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      ) : (
        <span className={`flex-1 text-sm ${isEmpty ? 'text-slate-300 italic' : 'text-slate-700 dark:text-slate-200 font-medium'}`}>
          {isEmpty ? placeholder : value}
        </span>
      )}
    </div>
  )
}

function DateRow({ label, value, editing, onChange, error }: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  error?: string
}) {
  const display = value ? formatDate(new Date(value).toISOString()) : ''
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3">
      <span className="text-xs text-slate-400 sm:w-28 shrink-0 sm:pt-0.5">{label}</span>
      {editing ? (
        <div>
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'text-sm text-slate-700 dark:text-slate-400 border rounded-lg px-2 py-0.5 focus:outline-none',
              error ? 'border-red-400 focus:border-red-500 dark:border-red-500' : 'border-slate-200 focus:border-[#4A8FE7]'
            )}
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      ) : (
        <span className={`text-sm ${display ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-300 italic'}`}>
          {display || 'Не указана'}
        </span>
      )}
    </div>
  )
}

interface FormFields {
  admin_internal_name: string
  object_number: string
  type: string
  description: string
  purpose: string
  admin_comment: string
  warranty_start: string
  warranty_end: string
  latitude: number | null
  longitude: number | null
}

type FormErrors = Partial<Record<keyof FormFields, string>>

function validate(f: FormFields): FormErrors {
  const e: FormErrors = {}
  if (!f.object_number.trim()) e.object_number = 'Обязательное поле'
  if (!f.type.trim()) e.type = 'Обязательное поле'
  if (f.warranty_start && f.warranty_end && new Date(f.warranty_end) < new Date(f.warranty_start)) {
    e.warranty_end = 'Не может быть раньше даты начала'
  }
  return e
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
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
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
    latitude: f.latitude,
    longitude: f.longitude,
  }
}

function LocationRow({ lat, lng, editing, onChange }: {
  lat: number | null
  lng: number | null
  editing: boolean
  onChange: (lat: number | null, lng: number | null) => void
}) {
  const hasLocation = lat != null && lng != null
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3">
      <span className="text-xs text-slate-400 sm:w-28 shrink-0 sm:pt-0.5">Местоположение</span>
      {editing ? (
        <div className="flex-1 min-w-0">
          <LocationPicker
            value={hasLocation ? { lat: lat!, lng: lng! } : null}
            onChange={(val) => onChange(val ? val.lat : null, val ? val.lng : null)}
          />
        </div>
      ) : (
        <span className={`flex-1 text-sm ${hasLocation ? 'text-slate-700 dark:text-slate-200 font-medium font-mono' : 'text-slate-300 italic'}`}>
          {hasLocation
            ? `${lat!.toFixed(5)}, ${lng!.toFixed(5)}`
            : 'Не указано'}
        </span>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div>
      <div className="bg-linear-to-r from-[#4A8FE7] to-[#1B3A72] px-6 py-5">
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
            <Skeleton className="h-3 w-24 shrink-0" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

function CabinetProjectRow({ cabinetId, cabinet, isAdmin }: {
  cabinetId: number
  cabinet: Cabinet
  isAdmin: boolean
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [projectId, setProjectId] = useState<number | null>(cabinet.project_id ?? null)

  const mutation = useMutation({
    mutationFn: (id: number | null) => cabinetsApi.setProject(cabinetId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet', cabinetId] })
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('Проект обновлён')
      setEditing(false)
    },
    onError: () => toast.error('Не удалось изменить проект'),
  })

  const cancel = () => {
    setProjectId(cabinet.project_id ?? null)
    setEditing(false)
  }

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4 px-4 sm:px-6 py-3">
      <span className="text-xs text-slate-400 sm:w-28 shrink-0 sm:pt-0.5">Проект</span>
      <div className="flex-1 min-w-0">
        {!editing ? (
          <span className={cn('text-sm', cabinet.project_name ? 'text-slate-700 dark:text-slate-200 font-medium' : 'text-slate-300 italic')}>
            {cabinet.project_name ?? 'Без проекта'}
          </span>
        ) : (
          <div className="space-y-2">
            <ProjectCombobox value={projectId} valueLabel={cabinet.project_name} onChange={setProjectId} />
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Если у проекта уже есть участники, они сразу получат доступ к этому шкафу — без дополнительного подтверждения.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} disabled={mutation.isPending} className="h-7 text-xs px-2 cursor-pointer">
                Отмена
              </Button>
              <Button
                onClick={() => mutation.mutate(projectId)}
                disabled={mutation.isPending}
                className="h-7 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white"
              >
                {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        )}
        {!editing && isAdmin && (
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer mt-0.5 block">
            + изменить проект
          </button>
        )}
      </div>
    </div>
  )
}

function CabinetTagsRow({ cabinetId, cabinet, isAdmin }: {
  cabinetId: number
  cabinet: import('@/types').Cabinet
  isAdmin: boolean
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Tag[]>((cabinet.tags ?? []) as Tag[])
  const [input, setInput] = useState('')
  const [creating, setCreating] = useState(false)

  const tagsQ = useQuery({ queryKey: ['tags', 'cabinet'], queryFn: () => kbApi.listTags('cabinet') })
  const allTags = tagsQ.data ?? []

  const tagMut = useMutation({
    mutationFn: () => cabinetsApi.updateCabinetTags(cabinetId, selectedTags.map(t => t.id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cabinet', cabinetId] })
      qc.invalidateQueries({ queryKey: ['cabinets'] })
      toast.success('Теги обновлены')
      setEditing(false)
      setInput('')
    },
    onError: () => toast.error('Ошибка при обновлении тегов'),
  })

  const available = allTags.filter(t => !selectedTags.some(s => s.id === t.id))
  const filtered = available.filter(t => t.name.toLowerCase().includes(input.toLowerCase()))
  const exactMatch = allTags.some(t => t.name.toLowerCase() === input.trim().toLowerCase())
  const showCreate = input.trim().length > 0 && !exactMatch

  const addTag = (tag: Tag) => { setSelectedTags(p => [...p, tag]); setInput('') }
  const removeTag = (id: number) => setSelectedTags(p => p.filter(t => t.id !== id))

  const handleCreate = async () => {
    if (!input.trim() || creating) return
    setCreating(true)
    try {
      const tag = await kbApi.createTag(input.trim(), 'cabinet')
      qc.invalidateQueries({ queryKey: ['tags', 'cabinet'] })
      addTag(tag)
    } catch { toast.error('Не удалось создать тег') }
    finally { setCreating(false) }
  }

  const cancel = () => {
    setSelectedTags((cabinet.tags ?? []) as Tag[])
    setInput('')
    setEditing(false)
  }

  const currentTags = editing ? selectedTags : (cabinet.tags ?? []) as Tag[]

  return (
    <div className="flex gap-4 px-6 py-3">
      <span className="text-xs text-slate-400 w-28 shrink-0 pt-0.5">Теги</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1.5 mb-1">
          {currentTags.length === 0 && !editing && (
            <span className="text-sm text-slate-300 italic">Нет тегов</span>
          )}
          {currentTags.map(tag => (
            <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1B3A72]/10 text-[#1B3A72] dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
              {tag.name}
              {editing && (
                <button onClick={() => removeTag(tag.id)} className="hover:text-red-500 transition-colors cursor-pointer leading-none">×</button>
              )}
            </span>
          ))}
        </div>

        {editing && (
          <div className="space-y-2 mt-2">
            <div className="relative">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); showCreate ? handleCreate() : filtered[0] && addTag(filtered[0]) } }}
                placeholder="Найти или создать тег..."
                className="w-full px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-400"
              />
              {input && (filtered.length > 0 || showCreate) && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden max-h-36 overflow-y-auto">
                  {filtered.map(tag => (
                    <button key={tag.id} onMouseDown={() => addTag(tag)} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                      {tag.name}
                    </button>
                  ))}
                  {showCreate && (
                    <button onMouseDown={handleCreate} disabled={creating} className="w-full text-left px-3 py-1.5 text-xs text-[#1B3A72] dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700 cursor-pointer flex gap-1">
                      <span className="font-medium">+ Создать</span> «{input.trim()}»
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancel} className="h-6 text-xs px-2 cursor-pointer">Отмена</Button>
              <Button onClick={() => tagMut.mutate()} disabled={tagMut.isPending} className="h-6 text-xs px-3 bg-[#1B3A72] hover:bg-[#1B3A72]/90 cursor-pointer dark:text-white">
                {tagMut.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </div>
        )}

        {!editing && isAdmin && (
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 transition-colors cursor-pointer mt-0.5">
            + редактировать теги
          </button>
        )}
      </div>
    </div>
  )
}

