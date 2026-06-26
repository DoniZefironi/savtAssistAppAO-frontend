import { AdminShell } from '@/components/layout/admin-shell'

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
