'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { registersApi, type RegisterDto } from '@/lib/api/registers'
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
  const [rawFeedOpen, setRawFeedOpen] = useState(false)
  const [rawFeedCabinetId, setRawFeedCabinetId] = useState<number | null>(null)
  const queryKey = ['register-definitions']

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => registersApi.getDefinitions(),
  })

  const addMut = useMutation({
    mutationFn: (dto: RegisterDto) => registersApi.createDefinition(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      toast.success('Регистр добавлен')
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Не удалось добавить регистр')),
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
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Карта регистров</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Стандартная расшифровка адресов, общая для всех ШУ. Для отдельного ШУ её можно дополнить или переопределить на вкладке «Переопределения карты» в его карточке.
              </p>
            </div>
            <button
              onClick={() => setRawFeedOpen(v => !v)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-[#1B3A72] dark:hover:text-blue-400 hover:border-[#4A8FE7] transition-colors cursor-pointer shrink-0"
            >
              {rawFeedOpen ? 'Скрыть сырую телеметрию' : 'Смотреть сырую телеметрию'}
            </button>
          </div>

          {rawFeedOpen && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-400">
                Выберите ШУ, чтобы видеть его текущие сырые значения (включая неописанные регистры) прямо во время заполнения карты.
              </p>
              <div className="max-w-sm">
                <CabinetCombobox value={rawFeedCabinetId} onChange={setRawFeedCabinetId} />
              </div>
              {rawFeedCabinetId != null && (
                <TelemetryLiveBoard cabinetId={rawFeedCabinetId} allowToggle={false} initialIncludeUnnamed compact />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-300 mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 sm:rounded-xl sm:m-6 sm:border sm:border-slate-100 dark:sm:border-slate-700/60">
          <RegisterMapTable
            items={data ?? []}
            isLoading={isLoading}
            canEdit={isAdmin}
            onAdd={(dto) => addMut.mutate(dto)}
            isAdding={addMut.isPending}
            onDelete={(id) => deleteMut.mutate(id)}
            deletingId={deletingId}
            emptyLabel="Карта регистров пока пуста"
          />
        </div>
      </div>
    </div>
  )
}
