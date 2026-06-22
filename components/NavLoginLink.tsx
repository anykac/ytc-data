'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function NavLoginLink() {
  const pathname = usePathname()
  if (pathname === '/login') return null
  return (
    <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
      Supervisor Login
    </Link>
  )
}
