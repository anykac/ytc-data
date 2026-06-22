import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NavLoginLink from './NavLoginLink'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: string | null = null
  if (user) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    role = data?.role ?? null
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <header className="bg-white border-b border-gray-200">
      {/* Top row: branding + user info */}
      <div className="px-6 py-2.5 flex items-center justify-between">
        <Link href="/entry" className="font-semibold text-gray-900">YTC Production</Link>
        {user && role ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user.email?.split('@')[0]}
              <span className="ml-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">{role}</span>
            </span>
            <form action={signOut}>
              <button type="submit" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer">Logout</button>
            </form>
          </div>
        ) : (
          <NavLoginLink />
        )}
      </div>
      {/* Bottom row: nav links (only when logged in) */}
      {user && role && (
        <nav className="px-6 py-2 border-t border-gray-100 flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Daily Summary</Link>
          <Link href="/dashboard/pipeline" className="text-sm text-gray-600 hover:text-gray-900">Pipeline</Link>
          <Link href="/dashboard/progress" className="text-sm text-gray-600 hover:text-gray-900">Model Progress</Link>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 ml-auto">Admin</Link>
        </nav>
      )}
    </header>
  )
}
