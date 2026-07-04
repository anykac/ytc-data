import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import StationsAdmin from './StationsAdmin'

export default async function StationsPage() {
  await requireRole('admin')
  const supabase = createAdminClient()
  const [{ data: customers, error: ce }, { data: stations, error }] = await Promise.all([
    supabase.from('customers').select('id, name').eq('active', true).order('sort_order'),
    supabase.from('stations').select('id, name, sequence, active, customer_id').order('sequence'),
  ])
  if (ce) throw ce
  if (error) throw error

  return <StationsAdmin stations={stations ?? []} customers={customers ?? []} />
}
