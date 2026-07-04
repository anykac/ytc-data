jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
import { createAdminClient } from '@/lib/supabase/admin'
import { getEditHistory } from '@/lib/db/admin'

describe('getEditHistory', () => {
  function mockEdits(rows: unknown[]) {
    const gteMock = jest.fn().mockReturnValue({
      lte: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({ data: rows, error: null }),
      }),
    })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'period_log_edits') {
          return { select: () => ({ gte: gteMock }) }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })
    return gteMock
  }

  it('joins rows with station/model/editor names instead of raw ids', async () => {
    mockEdits([
      {
        id: 'edit-1',
        edited_at: '2026-06-21T10:00:00.000Z',
        prev_target: 100, new_target: 110,
        prev_actual: 90, new_actual: 90,
        prev_pax: 5, new_pax: 5,
        prev_defects: 1, new_defects: 2,
        leads: { name: 'Alice' },
        period_log: {
          date: '2026-06-21',
          period: 'P1',
          stations: { name: 'Station 1' },
          models: { name: 'Model A' },
        },
      },
    ])

    const rows = await getEditHistory('2026-06-01', '2026-06-30')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      editId: 'edit-1',
      editedAt: '2026-06-21T10:00:00.000Z',
      editedByName: 'Alice',
      entryDate: '2026-06-21',
      period: 'P1',
      stationName: 'Station 1',
      modelName: 'Model A',
      target: { prev: 100, new: 110 },
      actual: { prev: 90, new: 90 },
      pax: { prev: 5, new: 5 },
      defects: { prev: 1, new: 2 },
    })
  })

  it('sorts by edited_at descending', async () => {
    mockEdits([
      {
        id: 'edit-newest',
        edited_at: '2026-06-22T10:00:00.000Z',
        prev_target: 1, new_target: 1, prev_actual: 1, new_actual: 1, prev_pax: 1, new_pax: 1, prev_defects: 0, new_defects: 0,
        leads: { name: 'Alice' },
        period_log: { date: '2026-06-22', period: 'P1', stations: { name: 'Station 1' }, models: { name: 'Model A' } },
      },
      {
        id: 'edit-oldest',
        edited_at: '2026-06-21T10:00:00.000Z',
        prev_target: 1, new_target: 1, prev_actual: 1, new_actual: 1, prev_pax: 1, new_pax: 1, prev_defects: 0, new_defects: 0,
        leads: { name: 'Alice' },
        period_log: { date: '2026-06-21', period: 'P1', stations: { name: 'Station 1' }, models: { name: 'Model A' } },
      },
    ])

    const rows = await getEditHistory('2026-06-01', '2026-06-30')

    expect(rows.map((r) => r.editId)).toEqual(['edit-newest', 'edit-oldest'])
  })

  it('filters by the edited_at date range (inclusive)', async () => {
    const gteMock = mockEdits([])

    await getEditHistory('2026-06-01', '2026-06-30')

    expect(gteMock).toHaveBeenCalledWith('edited_at', '2026-06-01T00:00:00.000Z')
    const lteMock = gteMock.mock.results[0].value.lte
    expect(lteMock).toHaveBeenCalledWith('edited_at', '2026-06-30T23:59:59.999Z')
  })

  it('returns [] for a range with no matching edits', async () => {
    mockEdits([])

    const rows = await getEditHistory('2026-06-01', '2026-06-30')

    expect(rows).toEqual([])
  })
})
