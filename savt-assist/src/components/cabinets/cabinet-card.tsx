import { Cabinet } from '@/types'
import { WarrantyBadge } from './warranty-badge'
import { Button } from '@/components/ui/button'

interface Props {
  cabinet: Cabinet
  isAdmin: boolean
  loading?: boolean
  onOpen: () => void    // view mode
  onEdit: () => void    // edit mode directly
  onQr: () => void
  onDelete?: () => void
}

export function CabinetCard({ cabinet, isAdmin, loading, onOpen, onEdit, onQr, onDelete }: Props) {
  const displayName = cabinet.admin_internal_name ?? cabinet.object_number

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-slate-200 transition-all group">

      {/* Icon — opens QR */}
      <button
        onClick={onQr}
        title="Показать QR-код"
        className="w-12 h-12 bg-[#1B3A72] rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-[#1B3A72]/80 transition-colors relative"
      >
        {loading ? (
          <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <>
            <BoardIcon />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/0 opacity-0 hover:opacity-100 rounded-xl transition-opacity">
              <QrIcon className="w-5 h-5 text-white" />
            </span>
          </>
        )}
      </button>

      {/* Info — opens detail */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <p className="font-semibold text-slate-800 truncate">{displayName}</p>
        <p className="text-sm text-slate-400 mt-0.5">{cabinet.object_number}</p>
        <div className="mt-1.5">
          <WarrantyBadge
            warrantyEndsAt={cabinet.warranty_ends_at}
            warrantyStatus={cabinet.warranty_status}
          />
        </div>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-[#1B3A72]"
            title="Редактировать"
            onClick={onEdit}
          >
            <EditIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-red-500"
            title="Удалить"
            onClick={onDelete}
          >
            <TrashIcon />
          </Button>
        </div>
      )}
    </div>
  )
}

function BoardIcon() {
  return (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    </svg>
  )
}
function QrIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
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
