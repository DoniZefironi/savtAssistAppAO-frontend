'use client'

import dynamic from 'next/dynamic'

const CabinetsMapInner = dynamic(
  () => import('./cabinets-map-inner').then((m) => ({ default: m.CabinetsMapInner })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse flex items-center justify-center">
        <span className="text-xs text-slate-400">Загрузка карты...</span>
      </div>
    ),
  }
)

export function CabinetsMap({ isAdmin }: { isAdmin: boolean }) {
  return <CabinetsMapInner isAdmin={isAdmin} />
}
