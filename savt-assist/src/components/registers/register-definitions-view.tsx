'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown } from 'lucide-react'
import { registersApi, type RegisterDto, type RegisterPatchDto } from '@/lib/api/registers'
import { cabinetsApi } from '@/lib/api/cabinets'
import { apiErrorMessage } from '@/lib/api/errors'
import { useAuthStore } from '@/lib/store/auth'
import { cn } from '@/lib/utils'
import { CabinetCombobox, cabinetLabel } from '@/components/ui/cabinet-combobox'
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
  // Свёрнута по умолчанию — карта регистров первична, живая телеметрия нужна
  // только пока заполняешь карту, не при каждом заходе. Сама панель-плашка
  // при этом всегда на виду (см. ниже) — открыть её можно в любой момент,
  // не разыскивая по странице.
  const [telemetryOpen, setTelemetryOpen] = useState(false)
  const queryKey = ['register-definitions']

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => registersApi.getDefinitions(),
  })

  // CabinetCombobox хранит выбранное название только во внутреннем состоянии —
  // на случай, если он всё же где-то размонтируется и смонтируется заново
  // (например, вся страница перемонтируется при переходе), тянем название
  // сюда отдельным запросом и передаём как valueLabel, а не полагаемся на то,
  // что компонент сам будет жить непрерывно.
  const { data: rawFeedCabinet } = useQuery({
    queryKey: ['cabinet-label', rawFeedCabinetId],
    queryFn: () => cabinetsApi.getOne(rawFeedCabinetId!),
    enabled: rawFeedCabinetId != null,
    staleTime: 60_000,
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
    // Раньше вся страница целиком была одной длинной прокруткой, и панель
    // телеметрии внизу можно было пролистать мимо. Теперь страница — сама
    // flex-колонка на всю высоту: прокручивается только средняя часть с
    // картой, а полоса телеметрии — соседний элемент этой колонки (shrink-0),
    // а не часть прокручиваемого содержимого, поэтому всегда прижата к низу
    // и всегда видна, свёрнута она или раскрыта.
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-4 sm:pb-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
        <h1 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">Карта регистров</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Стандартная расшифровка адресов, общая для всех ШУ. Для отдельного ШУ её можно дополнить или переопределить на вкладке «Переопределения карты» в его карточке.
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700/60 overflow-hidden">
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
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
        {/* Заголовок и combobox — теперь статичная шапка, не разворачивается
            вместе с содержимым и никогда не размонтируется (раньше combobox
            то появлялся, то пропадал вместе с панелью — теряя выбранное имя
            при каждом сворачивании, и рискуя обрезаться overflow:hidden
            анимируемой обёртки ниже, если бы жил внутри неё). */}
        <div
          onClick={() => setTelemetryOpen(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-3 sm:px-6 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <ChevronDown className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200', telemetryOpen && 'rotate-180')} />
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 shrink-0">Сырая телеметрия</span>
            {!telemetryOpen && (
              <span className="text-xs text-slate-400 truncate hidden sm:inline">
                — выберите ШУ, чтобы видеть его текущие сырые значения прямо во время заполнения карты
              </span>
            )}
          </div>
          {/* stopPropagation — иначе клик по самому комбобоксу (выбор ШУ,
              открытие его выпадающего списка) заодно сворачивал бы/разворачивал
              панель телеметрии под ним. */}
          <div className="shrink-0 w-56" onClick={e => e.stopPropagation()}>
            <CabinetCombobox
              value={rawFeedCabinetId}
              valueLabel={rawFeedCabinet ? cabinetLabel(rawFeedCabinet) : undefined}
              onChange={setRawFeedCabinetId}
            />
          </div>
        </div>

        {/* Тот же приём, что и в панелях фильтров (requests-view.tsx/users-view.tsx) —
            анимируется grid-template-rows между 0fr и 1fr, а не display/высота
            напрямую, поэтому плавно и без замера высоты контента в JS. */}
        <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', telemetryOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
          <div className="overflow-hidden min-h-0">
            <div className="border-t border-slate-100 dark:border-slate-700/60 px-3 sm:px-6 py-4 min-h-64 max-h-[45vh] overflow-y-auto">
              {rawFeedCabinetId != null ? (
                <TelemetryLiveBoard cabinetId={rawFeedCabinetId} allowToggle={false} initialIncludeUnnamed compact />
              ) : (
                <p className="text-xs text-slate-300 dark:text-slate-600 italic text-center py-8">Выберите ШУ выше</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
