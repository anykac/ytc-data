import { createClient } from '@/lib/supabase/server'
import EntryForm from '@/components/entry/EntryForm'

export default async function EntryPage() {
  const supabase = await createClient()

  const [{ data: stations, error: stErr }, { data: models, error: mErr }, { data: leads, error: lErr }] =
    await Promise.all([
      supabase.from('stations').select('id, name, sequence').eq('active', true).order('sequence'),
      supabase.from('models').select('id, name').eq('active', true).order('name'),
      supabase.from('leads').select('id, name').eq('active', true).order('name'),
    ])

  if (stErr) throw stErr
  if (mErr) throw mErr
  if (lErr) throw lErr

  return (
    <main className="flex-1 bg-gray-50 p-4">
      <EntryForm
        stations={stations ?? []}
        models={models ?? []}
        leads={leads ?? []}
      />
    </main>
  )
}
