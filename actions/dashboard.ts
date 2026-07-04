'use server'
import { requireRole } from '@/lib/auth/session'
import { getStepPeriodData } from '@/lib/db/order-model-tracker'
import type { StepPeriodPoint } from '@/lib/db/order-model-tracker'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function assertUuid(val: string, field: string) {
  if (!UUID_RE.test(val)) throw new Error(`Invalid ${field}`)
}

export async function fetchStepPeriodData(
  modelId: string,
  stationId: string,
  prevStationId: string | null,
): Promise<StepPeriodPoint[]> {
  await requireRole('supervisor')
  assertUuid(modelId, 'modelId')
  assertUuid(stationId, 'stationId')
  if (prevStationId !== null) assertUuid(prevStationId, 'prevStationId')
  return getStepPeriodData(modelId, stationId, prevStationId)
}
