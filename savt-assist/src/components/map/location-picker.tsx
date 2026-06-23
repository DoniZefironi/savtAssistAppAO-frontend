'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useDebounce } from '@/lib/hooks/use-debounce'

interface LatLng {
  lat: number
  lng: number
}

interface Props {
  value: LatLng | null
  onChange: (val: LatLng | null) => void
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

const LocationPickerInner = dynamic(
  () => import('./location-picker-inner').then((m) => ({ default: m.LocationPickerInner })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-xs text-slate-400">Загрузка карты...</span>
      </div>
    ),
  }
)

async function geocode(query: string): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'ru',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'savt-assist-admin/1.0' },
  })
  if (!res.ok) return []
  return res.json()
}

export function LocationPicker({ value, onChange }: Props) {
  const [address, setAddress] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const handleSearch = async () => {
    const q = address.trim()
    if (!q) return
    setSearching(true)
    setShowDropdown(false)
    try {
      const data = await geocode(q)
      setResults(data)
      setShowDropdown(data.length > 0)
    } finally {
      setSearching(false)
    }
  }

  const handleSelect = (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    onChange({ lat, lng })
    setAddress(r.display_name.split(',').slice(0, 2).join(',').trim())
    setShowDropdown(false)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex gap-2">
          <input
            ref={searchRef}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSearch() }
            }}
            placeholder="Введите адрес для поиска..."
            className="flex-1 text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-300"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !address.trim()}
            className="px-3 py-2 rounded-lg bg-[#1B3A72] text-white text-sm hover:bg-[#1B3A72]/85 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
          >
            {searching ? '...' : <SearchIcon className="w-4 h-4" />}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setAddress('') }}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 text-sm hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer shrink-0"
              title="Очистить"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onMouseDown={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-52 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 relative">
        <LocationPickerInner value={value} onChange={onChange} />
        <div className="absolute bottom-2 left-2 right-2 z-[1000] pointer-events-none">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            Кликните на карту, чтобы установить точку
          </p>
        </div>
      </div>

      {value && (
        <div className="flex gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Широта: <span className="font-mono text-slate-700 dark:text-slate-200">{value.lat.toFixed(6)}</span></span>
          <span>Долгота: <span className="font-mono text-slate-700 dark:text-slate-200">{value.lng.toFixed(6)}</span></span>
        </div>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
