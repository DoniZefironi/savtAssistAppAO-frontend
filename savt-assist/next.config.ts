import type { NextConfig } from "next";
import { API_URL } from "./src/lib/api/base-url";

// Файлы (фото ШУ, обои чата и т.д.) всегда отдаёт наш же бэкенд по /static/...,
// поэтому next/image достаточно доверять только его хосту — а не любому '**',
// что превращало /_next/image в открытый прокси произвольных URL (SSRF-риск).
const backendUrl = new URL(API_URL);

const nextConfig: NextConfig = {
  output: 'standalone',
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
