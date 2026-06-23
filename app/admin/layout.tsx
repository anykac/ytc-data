import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole('supervisor')

  return (
    <div className="flex flex-1">
      <nav className="w-48 shrink-0 border-r border-gray-200 bg-white px-3 py-6 space-y-1">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Admin</p>
        {[
          { href: '/admin/orders',   label: 'Orders' },
          { href: '/admin/models',   label: 'Models' },
          { href: '/admin/stations', label: 'Stations' },
          { href: '/admin/accounts', label: 'Accounts' },
          { href: '/admin/leads',    label: 'Leads' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            {label}
          </Link>
        ))}
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
