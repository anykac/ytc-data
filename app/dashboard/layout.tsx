import { requireRole } from '@/lib/auth/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRole('supervisor')
  return <div className="flex-1 bg-gray-50">{children}</div>
}
