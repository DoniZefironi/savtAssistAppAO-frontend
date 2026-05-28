import { OperatorSidebar } from '@/components/layout/operator-sidebar'
import { AdminHeader } from '@/components/layout/admin-header'

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      <OperatorSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        {children}
      </main>
    </div>
  )
}
