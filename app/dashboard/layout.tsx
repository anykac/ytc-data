import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRole('supervisor')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-semibold text-gray-900 mr-4">YTC Production</span>
        <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Daily Summary</Link>
        <Link href="/dashboard/pipeline" className="text-sm text-gray-600 hover:text-gray-900">Pipeline</Link>
        <Link href="/dashboard/progress" className="text-sm text-gray-600 hover:text-gray-900">Model Progress</Link>
        <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 ml-auto">Admin</Link>
        <Link href="/logout" className="text-sm text-gray-500 hover:text-gray-900">Log out</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
