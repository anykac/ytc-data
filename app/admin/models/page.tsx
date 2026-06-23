import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import ModelsAdmin from './ModelsAdmin'

export default async function ModelsPage() {
  await requireRole('supervisor')
  const supabase = createAdminClient()
  const [{ data: models, error: me }, { data: stations, error: se }] = await Promise.all([
    supabase.from('models').select('id, name, active').order('name'),
    supabase.from('stations').select('id, name, sequence').eq('active', true).order('sequence'),
  ])
  if (me) throw me
  if (se) throw se

  // Fetch active station configs for all models
  const modelIds = (models ?? []).map((m) => m.id)
  const { data: configs, error: ce } = modelIds.length > 0
    ? await supabase.from('model_station_config').select('model_id, station_id').in('model_id', modelIds).eq('active', true)
    : { data: [], error: null }
  if (ce) throw ce

  return <ModelsAdmin models={models ?? []} stations={stations ?? []} configs={configs ?? []} />
}
