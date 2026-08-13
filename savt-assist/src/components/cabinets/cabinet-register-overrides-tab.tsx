'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { registersApi, type RegisterDto } from '@/lib/api/registers'
import { apiErrorMessage } from '@/lib/api/errors'
import { RegisterMapTable } from '@/components/registers/register-map-table'

// Добавки/переопределения карты регистров для этого конкретного ШУ — при
// расшифровке телеметрии проверяются раньше стандартной (глобальной) карты
// (см. README-backend.md, «Рут admin: telemetry»).
export function RegisterOverridesTab({ cabinetId, isAdmin }: { cabinetId: number; isAdmin: boolean }) {
  const qc = useQueryClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const queryKey = ['cabinet-register-overrides', cabinetId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => registersApi.getOverrides(cabinetId),
  })

  const addMut = useMutation({
    // Битовая маска — несколько DTO на один адрес (разные bit), отправляем
    // по очереди одной мутацией, чтобы это была одна кнопка "Добавить" в UI.
    mutationFn: async (dtos: RegisterDto[]) => {
      for (const dto of dtos) await registersApi.createOverride(cabinetId, dto)
    },
    onSuccess: (_data, dtos) => {
      qc.invalidateQueries({ queryKey })
      toast.success(dtos.length > 1 ? `Добавлено регистров: ${dtos.length}` : 'Регистр добавлен')
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey })
      toast.error(apiErrorMessage(e, 'Не удалось добавить регистр'))
    },
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

  return (
    <>
      <p className="text-xs text-slate-400 px-6 pt-3">
        Действуют только для этого ШУ и имеют приоритет над стандартной картой регистров.
      </p>
      <RegisterMapTable
        items={data ?? []}
        isLoading={isLoading}
        canEdit={isAdmin}
        onAdd={(dtos) => addMut.mutate(dtos)}
        isAdding={addMut.isPending}
        onDelete={(id) => deleteMut.mutate(id)}
        deletingId={deletingId}
        emptyLabel="Для этого ШУ пока нет переопределений"
      />
    </>
  )
}
