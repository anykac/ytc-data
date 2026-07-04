import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import LeadsAdmin from './LeadsAdmin'

export default async function LeadsPage() {
  await requireRole('supervisor')
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, active')
    .order('name')
  if (error) throw error

  return <LeadsAdmin leads={data ?? []} />
}
