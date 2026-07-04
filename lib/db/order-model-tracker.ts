import { createAdminClient } from '@/lib/supabase/admin'

export type StepTrackerRow = {
  stationId: string
  stationName: string
  sequence: number
  cumulativeOutput: number
  activeInputs: number
  orderQty: number
  attainmentPct: number | null
}

export type StepPeriodPoint = {
  label: string
  date: string
  period: string
  periodOutput: number
  cumulativeOutput: number
  activeInputs: number
}

const PERIOD_ORDER = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'OT']

export async function getOrderModelSteps(
  orderId: string,
  modelId: string,
): Promise<{ rows: StepTrackerRow[]; orderNumber: string; modelName: string }> {
  const supabase = createAdminClient()

  const { data: line, error: lineError } = await supabase
    .from('order_lines')
    .select('quantity, orders!inner(order_number), models!inner(name)')
    .eq('order_id', orderId)
    .eq('model_id', modelId)
    .eq('active', true)
    .maybeSingle()
  if (lineError) throw lineError
  if (!line) throw new Error('Order line not found')

  const orderNumber = (line.orders as { order_number: string }).order_number
  const modelName = (line.models as { name: string }).name
  const orderQty = line.quantity

  const { data: configs, error: configError } = await supabase
    .from('model_station_config')
    .select('station_id, stations!inner(name, sequence)')
    .eq('model_id', modelId)
    .eq('active', true)
  if (configError) throw configError
  if (!configs || configs.length === 0) return { rows: [], orderNumber, modelName }

  const stations = (configs as Array<{ station_id: string; stations: { name: string; sequence: number } }>)
    .map((c) => ({ stationId: c.station_id, stationName: c.stations.name, sequence: c.stations.sequence }))
    .sort((a, b) => a.sequence - b.sequence)

  const stationIds = stations.map((s) => s.stationId)
  const { data: logs, error: logsError } = await supabase
    .from('period_log')
    .select('station_id, actual')
    .eq('model_id', modelId)
    .in('station_id', stationIds)
  if (logsError) throw logsError

  const outputByStation = new Map<string, number>()
  for (const log of logs ?? []) {
    outputByStation.set(log.station_id, (outputByStation.get(log.station_id) ?? 0) + log.actual)
  }

  const rows: StepTrackerRow[] = stations.map((s, i) => {
    const cumulativeOutput = outputByStation.get(s.stationId) ?? 0
    const prevOutput = i > 0 ? (outputByStation.get(stations[i - 1].stationId) ?? 0) : 0
    const activeInputs = i > 0 ? Math.max(0, prevOutput - cumulativeOutput) : 0
    return {
      stationId: s.stationId,
      stationName: s.stationName,
      sequence: s.sequence,
      cumulativeOutput,
      activeInputs,
      orderQty,
      attainmentPct: orderQty > 0 ? Math.round((cumulativeOutput / orderQty) * 100) : null,
    }
  })

  return { rows, orderNumber, modelName }
}

export async function getStepPeriodData(
  modelId: string,
  stationId: string,
  prevStationId: string | null,
): Promise<StepPeriodPoint[]> {
  const supabase = createAdminClient()

  const { data: logs, error } = await supabase
    .from('period_log')
    .select('date, period, actual')
    .eq('model_id', modelId)
    .eq('station_id', stationId)
  if (error) throw error

  const sorted = (logs ?? []).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
  })

  let running = 0
  const points = sorted.map((log) => {
    running += log.actual
    return { date: log.date, period: log.period, periodOutput: log.actual, cumulativeOutput: running }
  })

  if (!prevStationId) {
    return points.map((p) => ({ label: `${p.date} ${p.period}`, ...p, activeInputs: 0 }))
  }

  const { data: prevLogs, error: prevError } = await supabase
    .from('period_log')
    .select('date, period, actual')
    .eq('model_id', modelId)
    .eq('station_id', prevStationId)
  if (prevError) throw prevError

  const sortedPrev = (prevLogs ?? []).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period)
  })

  let prevRunning = 0
  const prevCumByKey = new Map<string, number>()
  for (const log of sortedPrev) {
    prevRunning += log.actual
    prevCumByKey.set(`${log.date}|${log.period}`, prevRunning)
  }

  // Build sorted list of prev station keys so we can find the latest one <= current point
  const prevKeysSorted = Array.from(prevCumByKey.keys()).sort()

  return points.map((p) => {
    const key = `${p.date}|${p.period}`
    let prevCum = 0
    for (const pk of prevKeysSorted) {
      if (pk <= key) prevCum = prevCumByKey.get(pk)!
      else break
    }
    return {
      label: `${p.date} ${p.period}`,
      ...p,
      activeInputs: Math.max(0, prevCum - p.cumulativeOutput),
    }
  })
}
