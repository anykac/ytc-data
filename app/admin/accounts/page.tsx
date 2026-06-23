import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import AccountsAdmin from './AccountsAdmin'

export default async function AccountsPage() {
  await requireRole('admin')
  const supabase = createAdminClient()

  const [{ data: { users }, error: ue }, { data: roles, error: re }] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase.from('user_roles').select('user_id, role'),
  ])
  if (ue) throw ue
  if (re) throw re

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.user_id, r.role as 'supervisor' | 'admin']))

  return (
    <AccountsAdmin
      users={users.map((u) => ({ id: u.id, email: u.email ?? '', role: roleMap[u.id] ?? null }))}
    />
  )
}
