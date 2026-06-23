'use client'

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useQuery } from '@tanstack/react-query'
import { cabinetsApi } from '@/lib/api/cabinets'
import { CabinetDetailDialog } from '@/components/cabinets/cabinet-detail-dialog'
import type { Cabinet } from '@/types'
import { formatDate, getWarrantyStatus } from '@/lib/warranty'

interface Props {
  isAdmin: boolean
}

type MarkerColor = 'red' | 'orange' | 'yellow' | 'green' | 'gray'

const MARKER_COLORS: Record<MarkerColor, string> = {
  red:    '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green:  '#22C55E',
  gray:   '#94A3B8',
}

const LEGEND: { color: MarkerColor; label: string }[] = [
  { color: 'red',    label: 'Открытая заявка' },
  { color: 'orange', label: 'Гарантия истекает' },
  { color: 'yellow', label: 'Гарантия истекла' },
  { color: 'green',  label: 'Всё в порядке' },
  { color: 'gray',   label: 'Без гарантии' },
]

const WARRANTY_LABELS: Record<string, string> = {
  active:        'активна',
  expiring_soon: 'истекает',
  expired:       'истекла',
}
const WARRANTY_DOT: Record<string, string> = {
  active:        '#22C55E',
  expiring_soon: '#F97316',
  expired:       '#EF4444',
}

function getMarkerColor(cabinet: Cabinet, openIds: Set<number>): MarkerColor {
  if (openIds.has(cabinet.id)) return 'red'
  const status = cabinet.warranty_status ?? getWarrantyStatus(cabinet.warranty_ends_at ?? null)
  if (status === 'expiring_soon') return 'orange'
  if (status === 'expired')       return 'yellow'
  if (status === 'active')        return 'green'
  return 'gray'
}

function createPinIcon(color: string) {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 24 14 24S28 23.333 28 14C28 6.268 21.732 0 14 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white" opacity="0.85"/>
    </svg>`,
    className: '',
    iconSize:   [28, 38],
    iconAnchor: [14, 38],
    popupAnchor:[0, -40],
  })
}

function FitBounds({ cabinets }: { cabinets: Cabinet[] }) {
  const map = useMap()
  useEffect(() => {
    if (cabinets.length === 0) return
    if (cabinets.length === 1) {
      map.setView([cabinets[0].latitude!, cabinets[0].longitude!], 13)
      return
    }
    const bounds = L.latLngBounds(cabinets.map(c => [c.latitude!, c.longitude!]))
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [cabinets, map])
  return null
}

function PopupContent({
  cabinet, openIds, onOpen,
}: {
  cabinet: Cabinet
  openIds: Set<number>
  onOpen: (id: number) => void
}) {
  const map = useMap()
  const name = cabinet.admin_internal_name || cabinet.object_number
  const hasOpen = openIds.has(cabinet.id)
  const warrantyStatus = cabinet.warranty_status ?? getWarrantyStatus(cabinet.warranty_ends_at ?? null)

  const handleOpen = () => {
    map.closePopup()
    onOpen(cabinet.id)
  }

  return (
    <div style={{ minWidth: 190, fontFamily: 'inherit' }}>
      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.3 }}>{name}</p>
      <p style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
        {[cabinet.object_number !== name ? cabinet.object_number : null, cabinet.type]
          .filter(Boolean).join(' · ')}
      </p>

      {warrantyStatus && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            backgroundColor: WARRANTY_DOT[warrantyStatus] ?? '#94A3B8',
          }} />
          <span style={{ fontSize: 11, color: '#475569' }}>
            Гарантия {WARRANTY_LABELS[warrantyStatus]}
            {cabinet.warranty_ends_at ? ` · ${formatDate(cabinet.warranty_ends_at)}` : ''}
          </span>
        </div>
      )}

      {hasOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: '#EF4444' }} />
          <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>Есть открытые заявки</span>
        </div>
      )}

      <button
        onClick={handleOpen}
        style={{
          marginTop: 8, width: '100%', fontSize: 12, padding: '6px 0',
          borderRadius: 8, backgroundColor: '#1B3A72', color: 'white',
          border: 'none', cursor: 'pointer', fontWeight: 600,
        }}
      >
        Открыть ШУ
      </button>
    </div>
  )
}

export function CabinetsMapInner({ isAdmin }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['cabinets-map'],
    queryFn: cabinetsApi.getCabinetsWithGeo,
    refetchInterval: 30_000,
  })

  const cabinets = data?.cabinets ?? []
  const openIds  = data?.openCabinetIds ?? new Set<number>()
  const withGeo  = cabinets.filter(c => c.latitude != null && c.longitude != null)

  return (
    <>
      <div className="relative w-full h-full">
        {isLoading && (
          <div className="absolute inset-0 z-[1001] bg-white/70 dark:bg-slate-800/70 rounded-xl flex items-center justify-center">
            <span className="text-xs text-slate-400">Загрузка...</span>
          </div>
        )}

        {withGeo.length === 0 && !isLoading && (
          <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center gap-2 text-slate-500 pointer-events-none">
            <MapPinOffIcon className="w-7 h-7" />
            <p className="text-xs bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg shadow">
              Нет ШУ с указанным местоположением
            </p>
          </div>
        )}

        <MapContainer
          center={[53.9, 27.5]}
          zoom={7}
          style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <FitBounds cabinets={withGeo} />
          {withGeo.map(cabinet => (
            <Marker
              key={cabinet.id}
              position={[cabinet.latitude!, cabinet.longitude!]}
              icon={createPinIcon(MARKER_COLORS[getMarkerColor(cabinet, openIds)])}
            >
              <Popup>
                <PopupContent cabinet={cabinet} openIds={openIds} onOpen={setSelectedId} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 dark:bg-slate-800/90 rounded-lg px-2.5 py-2 shadow text-xs space-y-1 pointer-events-none">
          {LEGEND.map(({ color, label }) => (
            <div key={color} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full border border-white/50 shadow-sm shrink-0"
                style={{ backgroundColor: MARKER_COLORS[color] }}
              />
              <span className="text-slate-600 dark:text-slate-300">{label}</span>
            </div>
          ))}
        </div>

        {cabinets.length > 0 && (
          <div className="absolute top-3 right-3 z-[1000] bg-white/90 dark:bg-slate-800/90 rounded-lg px-2.5 py-1.5 shadow text-xs text-slate-500 dark:text-slate-400 pointer-events-none">
            {withGeo.length} из {cabinets.length} ШУ на карте
          </div>
        )}
      </div>

      <CabinetDetailDialog
        cabinetId={selectedId}
        isAdmin={isAdmin}
        onClose={() => setSelectedId(null)}
      />
    </>
  )
}

function MapPinOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}
