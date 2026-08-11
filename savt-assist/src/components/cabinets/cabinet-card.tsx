import { Cabinet } from '@/types'
import { WarrantyBadge } from './warranty-badge'
import { formatDate } from '@/lib/warranty'
import { Button } from '@/components/ui/button'

interface Props {
  cabinet: Cabinet
  isAdmin: boolean
  view?: 'list' | 'grid'
  onOpen: () => void
  onEdit: () => void
  onDelete?: () => void
}

export function CabinetCard({ cabinet, isAdmin, view = 'list', onOpen, onEdit, onDelete }: Props) {
  const displayName = cabinet.admin_internal_name ?? cabinet.object_number

  if (view === 'grid') {
    return (
      <div className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 transition-all flex flex-col gap-2 cursor-pointer" onClick={onOpen}>

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{displayName}</p>
            <p className="text-xs text-slate-400 mt-0.5">{cabinet.object_number}</p>
          </div>
          {/* Действия в шапке карточки, а не поверх контента внизу — раньше перекрывали даты гарантии */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#1B3A72] cursor-pointer" title="Редактировать" onClick={onEdit}>
                  <EditIcon />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 cursor-pointer" title="Удалить" onClick={onDelete}>
                  <TrashIcon />
                </Button>
              </>
            )}
          </div>
        </div>

        {(cabinet.type || cabinet.purpose) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {[cabinet.type, cabinet.purpose].filter(Boolean).join(' · ')}
          </p>
        )}
        {cabinet.admin_comment && (
          <p className="text-xs text-slate-400 italic truncate">{cabinet.admin_comment}</p>
        )}

        <div className="mt-auto pt-1 flex items-center gap-2 flex-wrap">
          <WarrantyBadge warrantyEndsAt={cabinet.warranty_ends_at} warrantyStatus={cabinet.warranty_status} />
          {(cabinet.warranty_starts_at || cabinet.warranty_ends_at) && (
            <span className="text-xs text-slate-400">
              {formatDate(cabinet.warranty_starts_at)} — {formatDate(cabinet.warranty_ends_at)}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 transition-all group">

      <button
        onClick={onOpen}
        title={displayName}
        className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1B3A72] rounded-xl flex items-center justify-center shrink-0 hover:bg-[#1B3A72]/80 transition-colors relative cursor-pointer"
      >
        <CabinetIcon className="w-5 h-5 text-white" />
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName}</p>
        <p className="text-xs text-slate-400 mt-0.5">{cabinet.object_number}</p>

        {(cabinet.type || cabinet.purpose) && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {[cabinet.type, cabinet.purpose].filter(Boolean).join(' · ')}
          </p>
        )}
        {cabinet.admin_comment && (
          <p className="text-xs text-slate-400 italic mt-0.5 truncate">{cabinet.admin_comment}</p>
        )}

        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <WarrantyBadge warrantyEndsAt={cabinet.warranty_ends_at} warrantyStatus={cabinet.warranty_status} />
          {(cabinet.warranty_starts_at || cabinet.warranty_ends_at) && (
            <span className="text-xs text-slate-400">
              {formatDate(cabinet.warranty_starts_at)} — {formatDate(cabinet.warranty_ends_at)}
            </span>
          )}
        </div>
      </div>

      {isAdmin && (
        // pointer-coarse: на тач-устройствах hover нет — кнопки видны всегда
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#1B3A72] cursor-pointer" title="Редактировать" onClick={onEdit}>
            <EditIcon />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 cursor-pointer" title="Удалить" onClick={onDelete}>
            <TrashIcon />
          </Button>
        </div>
      )}
    </div>
  )
}


// Декоративная иконка вместо убранной кнопки QR (у ШУ больше нет своего QR-кода,
// см. README-backend.md, «Рут `admin: cabinets`» — /admin/cabinets/{id}/qr убран).
function CabinetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25A2.25 2.25 0 016 3h12a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0118 21H6a2.25 2.25 0 01-2.25-2.25V5.25z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M8.25 7.5h.008M8.25 16.5h.008" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
