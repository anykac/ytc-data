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
  const { data, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleError) throw roleError
  if (!data) redirect('/login')

  // Explicit allowlist per required level — exhaustive so any unexpected role is rejected
  const allowed: Record<UserRole, UserRole[]> = {
    supervisor: ['supervisor', 'admin'],
    admin: ['admin'],
  }
  if (!allowed[minRole].includes(data.role as UserRole)) redirect('/dashboard')
  return { user, role: data.role as UserRole }
}
