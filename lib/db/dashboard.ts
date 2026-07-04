import { createAdminClient } from '@/lib/supabase/admin'

export type DailySummaryRow = {
  stationId: string
  stationName: string
  sequence: number
  target: number
  actual: number
  attainmentPct: number | null
  variance: number
  defects: number
}

export async function getDailySummary(date: string, modelIds?: string[]): Promise<DailySummaryRow[]> {
  const supabase = createAdminClient()
  const baseQuery = supabase
    .from('period_log')
    .select('target, actual, defects, stations!inner(id, name, sequence)')
    .eq('date', date)

  if (modelIds && modelIds.length === 0) return []

  const { data, error } = await (
    modelIds ? baseQuery.in('model_id', modelIds) : baseQuery
  )

  if (error) throw error
  if (!data) return []

  const byStation = new Map<string, { name: string; sequence: number; target: number; actual: number; defects: number }>()
  for (const row of data) {
    const s = row.stations as { id: string; name: string; sequence: number }
    const ex = byStation.get(s.id) ?? { name: s.name, sequence: s.sequence, target: 0, actual: 0, defects: 0 }
    byStation.set(s.id, { ...ex, target: ex.target + row.target, actual: ex.actual + row.actual, defects: ex.defects + row.defects })
  }

  return Array.from(byStation.entries())
    .map(([stationId, s]) => ({
      stationId,
      stationName: s.name,
      sequence: s.sequence,
      target: s.target,
      actual: s.actual,
      attainmentPct: s.target > 0 ? Math.round((s.actual / s.target) * 100) : null,
      variance: s.actual - s.target,
      defects: s.defects,
    }))
    .sort((a, b) => a.sequence - b.sequence)
}

export type PipelineRow = DailySummaryRow & {
  gapToGoal: number
  wip: number | null
}

export async function getPipelineData(date: string, modelIds?: string[]): Promise<PipelineRow[]> {
  const summary = await getDailySummary(date, modelIds)
  return summary.map((row, i) => ({
    ...row,
    gapToGoal: row.target - row.actual,
    wip: i > 0 ? summary[i - 1].actual - row.actual : null,
  }))
}

export type ModelProgressRow = {
  modelId: string
  modelName: string
  totalOrdered: number
  totalProduced: number
  balanceRemaining: number
  earliestDueDate: string
}

export async function getModelProgress(): Promise<ModelProgressRow[]> {
  const supabase = createAdminClient()

  const { data: lines, error: linesError } = await supabase
    .from('order_lines')
    .select('quantity, model_id, models!inner(name), orders!inner(due_date, active)')
    .eq('active', true)
    .filter('orders.active', 'eq', true)

  if (linesError) throw linesError
  if (!lines) return []

  const modelMap = new Map<string, { name: string; totalOrdered: number; earliestDueDate: string }>()
  for (const line of lines) {
    const id = line.model_id
    const order = line.orders as { due_date: string }
    const ex = modelMap.get(id)
    if (!ex) {
      modelMap.set(id, { name: (line.models as { name: string }).name, totalOrdered: line.quantity, earliestDueDate: order.due_date })
    } else {
      modelMap.set(id, {
        ...ex,
        totalOrdered: ex.totalOrdered + line.quantity,
        earliestDueDate: order.due_date < ex.earliestDueDate ? order.due_date : ex.earliestDueDate,
      })
    }
  }

  const modelIds = Array.from(modelMap.keys())
  const { data: produced, error: producedError } = await supabase
    .from('period_log')
    .select('model_id, actual, stations!inner(sequence)')
    .in('model_id', modelIds)

  if (producedError) throw producedError

  // Only count actuals from the furthest station each model has reached.
  // A unit is "produced" when it exits the last station in the flow — summing
  // all stations would count the same unit multiple times.
  const modelMaxSeq = new Map<string, number>()
  for (const row of produced) {
    const seq = (row.stations as { sequence: number }).sequence
    const cur = modelMaxSeq.get(row.model_id) ?? 0
    if (seq > cur) modelMaxSeq.set(row.model_id, seq)
  }

  const producedMap = new Map<string, number>()
  for (const row of produced) {
    const seq = (row.stations as { sequence: number }).sequence
    if (seq === modelMaxSeq.get(row.model_id)) {
      producedMap.set(row.model_id, (producedMap.get(row.model_id) ?? 0) + row.actual)
    }
  }

  return Array.from(modelMap.entries())
    .map(([modelId, m]) => ({
      modelId,
      modelName: m.name,
      totalOrdered: m.totalOrdered,
      totalProduced: producedMap.get(modelId) ?? 0,
      balanceRemaining: m.totalOrdered - (producedMap.get(modelId) ?? 0),
      earliestDueDate: m.earliestDueDate,
    }))
    .sort((a, b) => a.earliestDueDate.localeCompare(b.earliestDueDate))
}

export type FullDataReportRow = {
  date: string
  period: string
  stationName: string
  modelName: string
  target: number
  actual: number
  pax: number
  defects: number
  submittedByName: string
  createdAt: string
  edited: boolean
}

export async function getFullDataReport(startDate: string, endDate: string): Promise<FullDataReportRow[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('period_log')
    .select(`
      id, date, period, target, actual, pax, defects, created_at,
      stations!inner(name, sequence),
      models!inner(name),
      leads!inner(name)
    `)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error
  if (!data || data.length === 0) return []

  const { data: edits, error: editsError } = await supabase
    .from('period_log_edits')
    .select('period_log_id')
    .in('period_log_id', data.map((row) => row.id))

  if (editsError) throw editsError
  const editedIds = new Set((edits ?? []).map((e) => e.period_log_id))

  return data
    .map((row) => {
      const station = row.stations as unknown as { name: string; sequence: number }
      const model = row.models as unknown as { name: string }
      const lead = row.leads as unknown as { name: string }
      return {
        stationSequence: station.sequence,
        row: {
          date: row.date,
          period: row.period,
          stationName: station.name,
          modelName: model.name,
          target: row.target,
          actual: row.actual,
          pax: row.pax,
          defects: row.defects,
          submittedByName: lead.name,
          createdAt: row.created_at,
          edited: editedIds.has(row.id),
        },
      }
    })
    .sort((a, b) => {
      if (a.row.date !== b.row.date) return a.row.date.localeCompare(b.row.date)
      if (a.row.period !== b.row.period) return a.row.period.localeCompare(b.row.period)
      return a.stationSequence - b.stationSequence
    })
    .map(({ row }) => row)
}
