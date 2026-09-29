'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { registersApi, type RegisterDto, type RegisterPatchDto } from '@/lib/api/registers'
import { apiErrorMessage } from '@/lib/api/errors'
import { Button } from '@/components/ui/button'
import { RegisterMapTable } from '@/components/registers/register-map-table'

// Добавки/переопределения карты регистров для этого конкретного ШУ — при
// расшифровке телеметрии проверяются раньше стандартной (глобальной) карты
// (см. README-backend.md, «Рут admin: telemetry»).
export function RegisterOverridesTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const queryKey = ['cabinet-register-overrides', cabinetId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => registersApi.getOverrides(cabinetId),
  })

  const addMut = useMutation({
    // См. register-definitions-view.tsx — последовательно и без остановки на
    // первой ошибке, чтобы один дубликат не блокировал остальной импорт.
    mutationFn: async (dtos: RegisterDto[]) => {
      let succeeded = 0
      let failed = 0
      for (const dto of dtos) {
        try {
          await registersApi.createOverride(cabinetId, dto)
          succeeded++
        } catch {
          failed++
        }
      }
      return { succeeded, failed, total: dtos.length }
    },
    onSuccess: ({ succeeded, failed, total }) => {
      qc.invalidateQueries({ queryKey })
      if (failed === 0) toast.success(total > 1 ? `Добавлено регистров: ${succeeded}` : 'Регистр добавлен')
      else if (succeeded === 0) toast.error(`Не удалось добавить ни одной записи (${failed})`)
      else toast.error(`Добавлено ${succeeded} из ${total}, не добавлено ${failed} (дубликаты адрес+бит?)`)
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось добавить регистр')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: RegisterPatchDto }) => registersApi.updateOverride(cabinetId, id, dto),
    onMutate: ({ id }) => setUpdatingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success('Регистр обновлён')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
    onSettled: () => setUpdatingId(null),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => registersApi.deleteOverride(cabinetId, id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success('Регистр удалён')
    },
    onError: () => toast.error('Не удалось удалить регистр'),
    onSettled: () => setDeletingId(null),
  })

  const exportMut = useMutation({ mutationFn: () => registersApi.exportCabinetMap(cabinetId) })

  return (
    <>
      <div className="flex items-start justify-between gap-3 px-6 pt-3">
        <p className="text-xs text-slate-400">
          Действуют только для этого ШУ и имеют приоритет над стандартной картой регистров.
        </p>
        {/* Действующая карта = стандартная + эти переопределения поверх, с колонкой
            «Источник» — сама эта таблица ниже показывает только переопределения,
            смёрженный результат собирает сервер. */}
        <Button variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending} className="h-7 text-xs px-2.5 shrink-0 cursor-pointer">
          <Download className="w-3.5 h-3.5 mr-1.5" /> {exportMut.isPending ? 'Экспорт...' : 'Скачать действующую карту'}
        </Button>
      </div>
      <RegisterMapTable
        items={data ?? []}
        isLoading={isLoading}
        canEdit={isAdmin}
        onAdd={async (dtos) => (await addMut.mutateAsync(dtos)).failed === 0}
        isAdding={addMut.isPending}
        onUpdate={async (id, dto) => {
          try { await updateMut.mutateAsync({ id, dto }); return true }
          catch { return false }
        }}
        updatingId={updatingId}
        onDelete={(id) => deleteMut.mutate(id)}
        deletingId={deletingId}
        emptyLabel="Для этого ШУ пока нет переопределений"
      />
    </>
  )
}
