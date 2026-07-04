import { createClient } from '@/lib/supabase/server'
import EntryForm from '@/components/entry/EntryForm'

export default async function EntryPage() {
  const supabase = await createClient()

  const [
    { data: customers, error: cErr },
    { data: stations, error: stErr },
    { data: models, error: mErr },
    { data: leads, error: lErr },
  ] = await Promise.all([
    supabase.from('customers').select('id, name').eq('active', true).order('sort_order'),
    supabase.from('stations').select('id, name, sequence, customer_id').eq('active', true).order('sequence'),
    supabase.from('models').select('id, name, customer_id').eq('active', true).order('name'),
    supabase.from('leads').select('id, name').eq('active', true).order('name'),
  ])

  if (cErr) throw cErr
  if (stErr) throw stErr
  if (mErr) throw mErr
  if (lErr) throw lErr

  return (
    <main className="flex-1 bg-gray-50 p-4">
      <EntryForm
        customers={customers ?? []}
        stations={stations ?? []}
        models={models ?? []}
        leads={leads ?? []}
      />
    </main>
  )
}
