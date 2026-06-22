import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  if (!data) redirect('/login?error=unauthorized')

  // Explicit allowlist per required level — exhaustive so any unexpected role is rejected
  const allowed: Record<UserRole, UserRole[]> = {
    supervisor: ['supervisor', 'admin'],
    admin: ['admin'],
  }
  if (!allowed[minRole].includes(data.role as UserRole)) redirect('/dashboard')
  return { user, role: data.role as UserRole }
}
