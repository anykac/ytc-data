import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'supervisor' | 'admin'

export async function requireSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(minRole: UserRole) {
  const user = await requireSession()
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!data) redirect('/login')
  if (minRole === 'admin' && data.role !== 'admin') redirect('/dashboard')
  return { user, role: data.role as UserRole }
}
