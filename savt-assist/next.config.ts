import type { NextConfig } from "next";
import { API_URL } from "./src/lib/api/base-url";

// Файлы (фото ШУ, обои чата и т.д.) всегда отдаёт наш же бэкенд по /static/...,
// поэтому next/image достаточно доверять только его хосту — а не любому '**',
// что превращало /_next/image в открытый прокси произвольных URL (SSRF-риск).
const backendUrl = new URL(API_URL);

// Внешние хосты, на которые ходит браузер: тайлы и геокодер OpenStreetMap
// (Leaflet, location-picker) и сам бэкенд (абсолютные ссылки на файлы).
// 'unsafe-inline' для скриптов нужен Next (инлайн-бутстрап) и скрипту темы в
// layout.tsx; всё остальное закрыто. CSP — только в production: dev-сервер
// использует eval и websocket для HMR.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${backendUrl.origin} https://*.tile.openstreetmap.org`,
  `media-src 'self' blob: ${backendUrl.origin}`,
  `frame-src 'self' blob: ${backendUrl.origin}`,
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: csp }] : []),
]

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      { protocol: backendUrl.protocol.replace(':', '') as 'http' | 'https', hostname: backendUrl.hostname },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${API_URL}/:path*`,
      },
    ]
  },
};

export default nextConfig;
