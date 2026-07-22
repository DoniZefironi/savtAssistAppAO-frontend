import { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/warranty'

interface Props {
  project: Project
  isAdmin: boolean
  view?: 'list' | 'grid'
  onOpen: () => void
  onQr: () => void
  onDelete?: () => void
}

export function ProjectCard({ project, isAdmin, view = 'list', onOpen, onQr, onDelete }: Props) {
  if (view === 'grid') {
    return (
      <div
        className="group relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-4 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 transition-all flex flex-col gap-2 cursor-pointer"
        onClick={onOpen}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{project.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{project.cabinet_count} шкафов</p>
          </div>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {isAdmin && onDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 cursor-pointer" title="Удалить" onClick={onDelete}>
                <TrashIcon />
              </Button>
            )}
            <button
              onClick={onQr}
              title="Показать QR-код"
              className="w-8 h-8 bg-[#1B3A72] rounded-lg flex items-center justify-center shrink-0 hover:bg-[#1B3A72]/80 transition-colors cursor-pointer"
            >
              <QrIcon className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-auto pt-1">{formatDate(project.created_at)}</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 transition-all group">
      <button
        onClick={onQr}
        title="Показать QR-код"
        className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1B3A72] rounded-xl flex items-center justify-center shrink-0 hover:bg-[#1B3A72]/80 transition-colors cursor-pointer"
      >
        <QrIcon className="w-5 h-5 text-white" />
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onOpen}>
        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{project.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{project.cabinet_count} шкафов · {formatDate(project.created_at)}</p>
      </div>

      {isAdmin && onDelete && (
        <div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 cursor-pointer" title="Удалить" onClick={onDelete}>
            <TrashIcon />
          </Button>
        </div>
      )}
    </div>
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
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}
