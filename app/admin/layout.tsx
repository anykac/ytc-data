import { requireRole } from '@/lib/auth/session'
import Link from 'next/link'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireRole('supervisor')

  const navItems = [
    { href: '/admin/orders',   label: 'Orders',   adminOnly: false },
    { href: '/admin/models',   label: 'Models',   adminOnly: false },
    { href: '/admin/edit-history', label: 'Edit History', adminOnly: false },
    { href: '/admin/stations', label: 'Stations', adminOnly: true  },
    { href: '/admin/accounts', label: 'Accounts', adminOnly: true  },
    { href: '/admin/leads',    label: 'Leads',    adminOnly: false },
  ].filter((item) => !item.adminOnly || role === 'admin')

  return (
    <div className="flex flex-1">
      <nav className="w-48 shrink-0 border-r border-gray-200 bg-white px-3 py-6 space-y-1">
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Admin</p>
        {navItems.map(({ href, label }) => (
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
