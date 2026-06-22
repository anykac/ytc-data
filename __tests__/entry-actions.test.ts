jest.mock('@/lib/auth/lead-auth', () => ({
  authenticateLead: jest.fn(),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { submitEntry, editEntry, searchEntries } from '@/actions/entry'
import { authenticateLead } from '@/lib/auth/lead-auth'
import { createAdminClient } from '@/lib/supabase/admin'

const baseData = {
  date: '2026-06-21',
  period: 'P1',
  stationId: 'station-uuid',
  modelId: 'model-uuid',
  target: 100,
  actual: 90,
  pax: 5,
  defects: 2,
  leadName: 'Alice',
  password: 'pass',
}

describe('submitEntry', () => {
  it('returns auth_failed when password is wrong', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue(null)
    const result = await submitEntry(baseData)
    expect(result.status).toBe('auth_failed')
  })

  it('returns duplicate when entry already exists and not confirmed', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'existing' } }) }) }) }) }) }) }),
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('duplicate')
  })

  it('returns success when auth passes and no duplicate', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    const mockInsert = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => table === 'period_log'
        ? { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }), insert: mockInsert }
        : {},
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('success')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ submitted_by: 'lead-1' }))
  })
})
