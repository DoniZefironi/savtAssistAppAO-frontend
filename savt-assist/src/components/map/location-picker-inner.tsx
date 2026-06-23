'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'

interface LatLng {
  lat: number
  lng: number
}

interface Props {
  value: LatLng | null
  onChange: (val: LatLng) => void
}

const DEFAULT_CENTER: [number, number] = [53.9, 27.5]
const DEFAULT_ZOOM = 7

function createPickerIcon() {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 24 14 24S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#1B3A72" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
    </svg>`,
    className: '',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -40],
  })
}

function ClickHandler({ onChange }: { onChange: (val: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  const prev = useRef<[number, number] | null>(null)
  useEffect(() => {
    if (!position) return
    if (prev.current?.[0] === position[0] && prev.current?.[1] === position[1]) return
    prev.current = position
    map.flyTo(position, Math.max(map.getZoom(), 13))
  }, [position, map])
  return null
}

export function LocationPickerInner({ value, onChange }: Props) {
  const position: [number, number] | null = value ? [value.lat, value.lng] : null
  const icon = createPickerIcon()

  return (
    <MapContainer
      center={position ?? DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ClickHandler onChange={onChange} />
      <FlyTo position={position} />
      {position && <Marker position={position} icon={icon} />}
    </MapContainer>
  )
}
