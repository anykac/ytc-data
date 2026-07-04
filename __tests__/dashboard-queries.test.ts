jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'
import { getDailySummary, getPipelineData, getModelProgress, getFullDataReport } from '@/lib/db/dashboard'

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

describe('getDailySummary with modelIds filter', () => {
  it('calls .in() with modelIds when provided and returns filtered rows', async () => {
    const inMock = jest.fn().mockReturnValue({
      data: [{ target: 100, actual: 80, defects: 3, stations: { id: 's1', name: 'Station 1', sequence: 1 } }],
      error: null,
    })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ in: inMock }) }) }),
    })
    const rows = await getDailySummary('2026-06-21', ['model-a'])
    expect(inMock).toHaveBeenCalledWith('model_id', ['model-a'])
    expect(rows).toHaveLength(1)
    expect(rows[0].stationName).toBe('Station 1')
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

describe('getFullDataReport', () => {
  function mockPeriodLogAndEdits(periodLogRows: unknown[], editRows: { period_log_id: string }[] = []) {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'period_log') {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({ data: periodLogRows, error: null }),
              }),
            }),
          }
        }
        if (table === 'period_log_edits') {
          return {
            select: () => ({
              in: () => ({ data: editRows, error: null }),
            }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })
  }

  it('joins rows with station/model/lead names instead of raw ids', async () => {
    mockPeriodLogAndEdits([
      {
        id: 'row-1',
        date: '2026-06-21',
        period: 'P1',
        target: 100,
        actual: 90,
        pax: 5,
        defects: 1,
        created_at: '2026-06-21T08:00:00Z',
        stations: { name: 'Station 1', sequence: 1 },
        models: { name: 'Model A' },
        leads: { name: 'Alice' },
      },
    ])

    const rows = await getFullDataReport('2026-06-21', '2026-06-21')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      date: '2026-06-21',
      period: 'P1',
      stationName: 'Station 1',
      modelName: 'Model A',
      target: 100,
      actual: 90,
      pax: 5,
      defects: 1,
      submittedByName: 'Alice',
      createdAt: '2026-06-21T08:00:00Z',
      edited: false,
    })
    expect((rows[0] as unknown as { station_id?: string }).station_id).toBeUndefined()
  })

  it('sorts by date ascending, then period, then station sequence within each date', async () => {
    mockPeriodLogAndEdits([
      {
        id: 'row-late-date',
        date: '2026-06-22',
        period: 'P1',
        target: 10, actual: 10, pax: 1, defects: 0,
        created_at: '2026-06-22T08:00:00Z',
        stations: { name: 'Station 1', sequence: 1 },
        models: { name: 'Model A' },
        leads: { name: 'Alice' },
      },
      {
        id: 'row-seq-2',
        date: '2026-06-21',
        period: 'P1',
        target: 10, actual: 10, pax: 1, defects: 0,
        created_at: '2026-06-21T08:00:00Z',
        stations: { name: 'Station 2', sequence: 2 },
        models: { name: 'Model A' },
        leads: { name: 'Alice' },
      },
      {
        id: 'row-period-2',
        date: '2026-06-21',
        period: 'P2',
        target: 10, actual: 10, pax: 1, defects: 0,
        created_at: '2026-06-21T09:00:00Z',
        stations: { name: 'Station 1', sequence: 1 },
        models: { name: 'Model A' },
        leads: { name: 'Alice' },
      },
      {
        id: 'row-seq-1',
        date: '2026-06-21',
        period: 'P1',
        target: 10, actual: 10, pax: 1, defects: 0,
        created_at: '2026-06-21T07:00:00Z',
        stations: { name: 'Station 1', sequence: 1 },
        models: { name: 'Model A' },
        leads: { name: 'Alice' },
      },
    ])

    const rows = await getFullDataReport('2026-06-21', '2026-06-22')

    expect(rows.map((r) => r.date)).toEqual([
      '2026-06-21', '2026-06-21', '2026-06-21', '2026-06-22',
    ])
    expect(rows.slice(0, 3).map((r) => r.period)).toEqual(['P1', 'P1', 'P2'])
    expect(rows.slice(0, 2).map((r) => r.stationName)).toEqual(['Station 1', 'Station 2'])
  })

  it('flags edited as true only for rows with a matching period_log_edits entry', async () => {
    mockPeriodLogAndEdits(
      [
        {
          id: 'row-1',
          date: '2026-06-21',
          period: 'P1',
          target: 10, actual: 10, pax: 1, defects: 0,
          created_at: '2026-06-21T08:00:00Z',
          stations: { name: 'Station 1', sequence: 1 },
          models: { name: 'Model A' },
          leads: { name: 'Alice' },
        },
        {
          id: 'row-2',
          date: '2026-06-21',
          period: 'P2',
          target: 10, actual: 10, pax: 1, defects: 0,
          created_at: '2026-06-21T09:00:00Z',
          stations: { name: 'Station 1', sequence: 1 },
          models: { name: 'Model A' },
          leads: { name: 'Alice' },
        },
      ],
      [{ period_log_id: 'row-2' }],
    )

    const rows = await getFullDataReport('2026-06-21', '2026-06-21')

    const row1 = rows.find((r) => r.period === 'P1')
    const row2 = rows.find((r) => r.period === 'P2')
    expect(row1?.edited).toBe(false)
    expect(row2?.edited).toBe(true)
  })

  it('returns [] for an empty date range with no matching rows', async () => {
    mockPeriodLogAndEdits([])

    const rows = await getFullDataReport('2026-01-01', '2026-01-02')

    expect(rows).toEqual([])
  })
})
