import { authenticateLead, hashPassword } from '@/lib/auth/lead-auth'

jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(),
}))

import { createAdminClient } from '@/lib/supabase/admin'

describe('authenticateLead', () => {
  it('returns null when lead is not found', async () => {
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
    })
    const result = await authenticateLead('Unknown', 'password')
    expect(result).toBeNull()
  })

  it('returns null when password does not match', async () => {
    const hash = await hashPassword('correct')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'lead-1', password_hash: hash }, error: null }) }) }) }) }),
    })
    const result = await authenticateLead('Lead A', 'wrong')
    expect(result).toBeNull()
  })

  it('returns lead id when password matches', async () => {
    const hash = await hashPassword('correct')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'lead-1', password_hash: hash }, error: null }) }) }) }) }),
    })
    const result = await authenticateLead('Lead A', 'correct')
    expect(result).toBe('lead-1')
  })

  it('throws on database error rather than returning null', async () => {
    const dbError = new Error('connection refused')
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: dbError }) }) }) }) }),
    })
    await expect(authenticateLead('Lead A', 'password')).rejects.toThrow('connection refused')
  })
})
