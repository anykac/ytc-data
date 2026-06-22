'use server'
import { authenticateLead } from '@/lib/auth/lead-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type EntryFormData = {
  date: string
  period: string
  stationId: string
  modelId: string
  target: number
  actual: number
  pax: number
  defects: number
  leadName: string
  password: string
  confirmDuplicate?: boolean
}

export type EntryResult =
  | { status: 'success' }
  | { status: 'auth_failed' }
  | { status: 'duplicate' }
  | { status: 'error'; message: string }

export async function submitEntry(data: EntryFormData): Promise<EntryResult> {
  if (data.defects > data.actual) return { status: 'error', message: 'Value must be less than or equal to Actual output.' }

  const leadId = await authenticateLead(data.leadName, data.password)
  if (!leadId) return { status: 'auth_failed' }

  const supabase = createAdminClient()

  if (!data.confirmDuplicate) {
    const { data: existing, error: dupError } = await supabase
      .from('period_log')
      .select('id')
      .eq('date', data.date)
      .eq('period', data.period)
      .eq('station_id', data.stationId)
      .eq('model_id', data.modelId)
      .maybeSingle()

    if (dupError) return { status: 'error', message: dupError.message }
    if (existing) return { status: 'duplicate' }
  }

  const { error } = await supabase.from('period_log').insert({
    date: data.date,
    period: data.period,
    station_id: data.stationId,
    model_id: data.modelId,
    target: data.target,
    actual: data.actual,
    pax: data.pax,
    defects: data.defects,
    submitted_by: leadId,
  })

  return error ? { status: 'error', message: error.message } : { status: 'success' }
}

export type EditData = {
  entryId: string
  leadName: string
  password: string
  target: number
  actual: number
  pax: number
  defects: number
}

export type EditResult =
  | { status: 'success' }
  | { status: 'auth_failed' }
  | { status: 'error'; message: string }

export async function editEntry(data: EditData): Promise<EditResult> {
  if (data.defects > data.actual) return { status: 'error', message: 'Value must be less than or equal to Actual output.' }

  const leadId = await authenticateLead(data.leadName, data.password)
  if (!leadId) return { status: 'auth_failed' }

  const supabase = createAdminClient()

  const { data: current, error: fetchError } = await supabase
    .from('period_log')
    .select('target, actual, pax, defects')
    .eq('id', data.entryId)
    .single()

  if (fetchError || !current) return { status: 'error', message: 'Entry not found' }

  const { error: updateError } = await supabase
    .from('period_log')
    .update({ target: data.target, actual: data.actual, pax: data.pax, defects: data.defects })
    .eq('id', data.entryId)

  if (updateError) return { status: 'error', message: updateError.message }

  const { error: auditError } = await supabase.from('period_log_edits').insert({
    period_log_id: data.entryId,
    edited_by: leadId,
    prev_target: current.target,
    new_target: data.target,
    prev_actual: current.actual,
    new_actual: data.actual,
    prev_pax: current.pax,
    new_pax: data.pax,
    prev_defects: current.defects,
    new_defects: data.defects,
  })

  return auditError ? { status: 'error', message: auditError.message } : { status: 'success' }
}

export async function searchEntries(stationId: string, period: string, date: string) {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('period_log')
    .select(`
      id, date, period, target, actual, pax, defects, created_at,
      stations(name),
      models(name),
      leads(name)
    `)
    .eq('station_id', stationId)
    .eq('period', period)
    .eq('date', date)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}
