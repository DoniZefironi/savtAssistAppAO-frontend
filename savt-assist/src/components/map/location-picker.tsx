'use client'

import { useState, useRef, useEffect } from 'react'
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

function normalizeQuery(q: string): string {
  return q
    .trim()
    .replace(/\s*,+\s*/g, ', ')
    .replace(/\s+/g, ' ')
}

async function geocode(query: string): Promise<NominatimResult[]> {
  const normalized = normalizeQuery(query)
  if (normalized.length < 3) return []
  const params = new URLSearchParams({
    q: normalized,
    format: 'json',
    limit: '5',
    'accept-language': 'ru',
    countrycodes: 'by,ru,ua,kz',
  })
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'savt-assist-admin/1.0' },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export function LocationPicker({ value, onChange }: Props) {
  const [address, setAddress] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  const debouncedAddress = useDebounce(address, 500)

  useEffect(() => {
    const q = normalizeQuery(debouncedAddress)
    if (q.length < 3) {
      setResults([])
      setShowDropdown(false)
      return
    }
    let cancelled = false
    setSearching(true)
    geocode(q).then(data => {
      if (cancelled) return
      setResults(data)
      setActiveIdx(-1)
      if (data.length > 0) {
        // auto-place marker on first result; keep dropdown open for manual override
        onChangeRef.current({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) })
        setShowDropdown(data.length > 1)
      } else {
        setShowDropdown(false)
      }
    }).finally(() => {
      if (!cancelled) setSearching(false)
    })
    return () => { cancelled = true }
  }, [debouncedAddress])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (r: NominatimResult) => {
    onChange({ lat: parseFloat(r.lat), lng: parseFloat(r.lon) })
    setAddress(r.display_name.split(',').slice(0, 3).join(',').trim())
    setShowDropdown(false)
    setResults([])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIdx >= 0 ? activeIdx : 0
      if (results[idx]) handleSelect(results[idx])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={address}
              onChange={(e) => { setAddress(e.target.value); setShowDropdown(false) }}
              onKeyDown={handleKeyDown}
              placeholder="Минск, ул. Независимости 1..."
              className="w-full text-sm px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#4A8FE7] placeholder:text-slate-300"
            />
            {searching && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <SpinIcon className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              </span>
            )}
          </div>
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
          <div
            ref={dropRef}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg overflow-hidden max-h-44 overflow-y-auto"
          >
            {results.map((r, idx) => (
              <button
                key={r.place_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r) }}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 transition-colors cursor-pointer border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${
                  activeIdx === idx ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-52 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 relative">
        <LocationPickerInner value={value} onChange={onChange} />
        <div className="absolute bottom-2 left-2 right-2 z-1000 pointer-events-none">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center">
            Кликните на карту или введите адрес выше
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function SpinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
