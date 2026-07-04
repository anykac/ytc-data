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

function customerLookup(customerId: string) {
  return { select: () => ({ eq: () => ({ single: async () => ({ data: { customer_id: customerId }, error: null }) }) }) }
}

const duplicateCheckChain = (existing: { id: string } | null) =>
  ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing }) }) }) }) }) }) })

describe('submitEntry', () => {
  it('returns auth_failed when password is wrong', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue(null)
    const result = await submitEntry(baseData)
    expect(result.status).toBe('auth_failed')
  })

  it('returns duplicate when entry already exists and not confirmed', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'stations') return customerLookup('cust-1')
        if (table === 'models') return customerLookup('cust-1')
        return duplicateCheckChain({ id: 'existing' })
      },
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('duplicate')
  })

  it('returns success when auth passes and no duplicate', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    const mockInsert = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'stations') return customerLookup('cust-1')
        if (table === 'models') return customerLookup('cust-1')
        if (table === 'period_log') return { ...duplicateCheckChain(null), insert: mockInsert }
        return {}
      },
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('success')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ submitted_by: 'lead-1' }))
  })

  it('rejects a station/model pair from different customers', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'stations') return customerLookup('cust-meanwell')
        if (table === 'models') return customerLookup('cust-martindale')
        return {}
      },
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('error')
    if (result.status === 'error') expect(result.message).toMatch(/different customers/i)
  })

  it('succeeds when station and model share a customer', async () => {
    ;(authenticateLead as jest.Mock).mockResolvedValue('lead-1')
    const mockInsert = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'stations') return customerLookup('cust-1')
        if (table === 'models') return customerLookup('cust-1')
        if (table === 'period_log') return { ...duplicateCheckChain(null), insert: mockInsert }
        return {}
      },
    })
    const result = await submitEntry(baseData)
    expect(result.status).toBe('success')
  })
})
