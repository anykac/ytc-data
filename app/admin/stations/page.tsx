import { createAdminClient } from '@/lib/supabase/admin'
import StationsAdmin from './StationsAdmin'

export default async function StationsPage() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('stations')
    .select('id, name, sequence, active')
    .order('sequence')
  if (error) throw error

  return <StationsAdmin stations={data ?? []} />
}
