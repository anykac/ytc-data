jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'
import { getDailySummary, getPipelineData, getModelProgress } from '@/lib/db/dashboard'

describe('getDailySummary', () => {
  it('aggregates target/actual/defects by station and sorts by sequence', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              { target: 100, actual: 80, defects: 3, stations: { id: 's1', name: 'Station 1', sequence: 1 } },
              { target: 50,  actual: 40, defects: 1, stations: { id: 's1', name: 'Station 1', sequence: 1 } },
              { target: 90,  actual: 90, defects: 0, stations: { id: 's2', name: 'Station 2', sequence: 2 } },
            ],
          }),
        }),
      }),
    })
    const rows = await getDailySummary('2026-06-21')
    expect(rows).toHaveLength(2)
    expect(rows[0].stationName).toBe('Station 1')
    expect(rows[0].target).toBe(150)
    expect(rows[0].actual).toBe(120)
    expect(rows[0].attainmentPct).toBe(80)
    expect(rows[0].variance).toBe(-30)
    expect(rows[1].attainmentPct).toBe(100)
  })
})

describe('getPipelineData', () => {
  it('computes WIP as upstream actual minus current station actual', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [
              { target: 100, actual: 90, defects: 0, stations: { id: 's1', name: 'Station 1', sequence: 1 } },
              { target: 100, actual: 70, defects: 2, stations: { id: 's2', name: 'Station 2', sequence: 2 } },
            ],
          }),
        }),
      }),
    })
    const rows = await getPipelineData('2026-06-21')
    expect(rows[0].wip).toBeNull()
    expect(rows[1].wip).toBe(20)
    expect(rows[1].gapToGoal).toBe(30)
  })
})
