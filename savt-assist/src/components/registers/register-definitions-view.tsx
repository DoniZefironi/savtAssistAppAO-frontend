'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { registersApi, type RegisterDto, type RegisterPatchDto } from '@/lib/api/registers'
import { apiErrorMessage } from '@/lib/api/errors'
import { useAuthStore } from '@/lib/store/auth'
import { CabinetCombobox } from '@/components/ui/cabinet-combobox'
import { RegisterMapTable } from './register-map-table'
import { TelemetryLiveBoard } from './telemetry-live-board'

// Стандартная карта регистров, общая для всех ШУ — просмотр доступен
// оператору, правка только админу (см. README-backend.md, «Рут admin:
// telemetry»). Расшифровка телеметрии сначала смотрит переопределения
// конкретного ШУ и только потом эту карту.
export function RegisterDefinitionsView() {
  const isAdmin = useAuthStore(s => s.user?.role !== 'operator')
  const qc = useQueryClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [rawFeedCabinetId, setRawFeedCabinetId] = useState<number | null>(null)
  const queryKey = ['register-definitions']

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => registersApi.getDefinitions(),
  })

  const addMut = useMutation({
    // Импорт из таблицы/весь адрес разом — это десятки-сотни строк одной
    // отправкой; шлём по очереди (не параллельно — не долбить бэкенд пачкой
    // одновременных запросов) и не прерываемся на первой же ошибке (например,
    // дубликат адрес+бит) — иначе одна плохая строка блокировала бы импорт
    // всех остальных, корректных.
    mutationFn: async (dtos: RegisterDto[]) => {
      let succeeded = 0
      let failed = 0
      for (const dto of dtos) {
        try {
          await registersApi.createDefinition(dto)
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
    mutationFn: ({ id, dto }: { id: number; dto: RegisterPatchDto }) => registersApi.updateDefinition(id, dto),
    onMutate: ({ id }) => setUpdatingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success('Регистр обновлён')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось сохранить')),
    onSettled: () => setUpdatingId(null),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => registersApi.deleteDefinition(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success('Регистр удалён')
    },
    onError: () => toast.error('Не удалось удалить регистр'),
    onSettled: () => setDeletingId(null),
  })

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <div className="max-w-300 mx-auto w-full">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Карта регистров</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Стандартная расшифровка адресов, общая для всех ШУ. Для отдельного ШУ её можно дополнить или переопределить на вкладке «Переопределения карты» в его карточке.
          </p>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-4 sm:py-6">
        <div className="max-w-300 mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700/60 overflow-hidden">
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
              emptyLabel="Карта регистров пока пуста"
            />
          </div>

          <div className="lg:sticky lg:top-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700/60 p-4 space-y-3">
            <div>
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">Сырая телеметрия</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Выберите ШУ, чтобы видеть его текущие сырые значения (включая неописанные регистры) прямо во время заполнения карты.
              </p>
            </div>
            <CabinetCombobox value={rawFeedCabinetId} onChange={setRawFeedCabinetId} />
            {rawFeedCabinetId != null ? (
              <TelemetryLiveBoard cabinetId={rawFeedCabinetId} allowToggle={false} initialIncludeUnnamed compact />
            ) : (
              <p className="text-xs text-slate-300 dark:text-slate-600 italic text-center py-8">Выберите ШУ выше</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
