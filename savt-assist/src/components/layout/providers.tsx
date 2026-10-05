'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { ModalBackdrop } from '@/components/ui/app-modal'
import { ConfirmHost } from '@/components/ui/confirm-dialog'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ModalBackdrop />
      <ConfirmHost />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
