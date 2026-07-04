import { createAdminClient } from '@/lib/supabase/admin'

export type EditHistoryRow = {
  editId: string
  editedAt: string
  editedByName: string
  entryDate: string
  period: string
  stationName: string
  modelName: string
  target: { prev: number; new: number }
  actual: { prev: number; new: number }
  pax: { prev: number; new: number }
  defects: { prev: number; new: number }
}

export async function getEditHistory(startDate: string, endDate: string): Promise<EditHistoryRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('period_log_edits')
    .select(`
      id, edited_at,
      prev_target, new_target, prev_actual, new_actual, prev_pax, new_pax, prev_defects, new_defects,
      leads!inner(name),
      period_log!inner(date, period, stations!inner(name), models!inner(name))
    `)
    .gte('edited_at', `${startDate}T00:00:00.000Z`)
    .lte('edited_at', `${endDate}T23:59:59.999Z`)
    .order('edited_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  return data.map((row) => {
    const lead = row.leads as unknown as { name: string }
    const entry = row.period_log as unknown as {
      date: string
      period: string
      stations: { name: string }
      models: { name: string }
    }
    return {
      editId: row.id,
      editedAt: row.edited_at,
      editedByName: lead.name,
      entryDate: entry.date,
      period: entry.period,
      stationName: entry.stations.name,
      modelName: entry.models.name,
      target: { prev: row.prev_target, new: row.new_target },
      actual: { prev: row.prev_actual, new: row.new_actual },
      pax: { prev: row.prev_pax, new: row.new_pax },
      defects: { prev: row.prev_defects, new: row.new_defects },
    }
  })
}
