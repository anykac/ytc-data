'use server'
import { requireRole } from '@/lib/auth/session'
import { getStepPeriodData } from '@/lib/db/order-model-tracker'
import type { StepPeriodPoint } from '@/lib/db/order-model-tracker'

export async function fetchStepPeriodData(
  modelId: string,
  stationId: string,
  prevStationId: string | null,
): Promise<StepPeriodPoint[]> {
  await requireRole('supervisor')
  return getStepPeriodData(modelId, stationId, prevStationId)
}
