jest.mock('@/lib/auth/session', () => ({ requireRole: jest.fn() }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { upsertStation, reorderStations, upsertOrder } from '@/actions/admin'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

const CUSTOMER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

function validId(n: number) {
  return `bbbbbbbb-bbbb-bbbb-bbbb-${String(n).padStart(12, '0')}`
}

describe('upsertStation (insert)', () => {
  it('scopes the sequence-shift query to the new station\'s own customer', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' })

    const gteMock = jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    })
    const eqMock = jest.fn().mockReturnValue({ gte: gteMock })
    const insertMock = jest.fn().mockResolvedValue({ error: null })

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ select: () => ({ eq: eqMock }), insert: insertMock }),
    })

    await upsertStation({ name: 'New Station', sequence: 2, active: true, customerId: CUSTOMER_ID })

    expect(eqMock).toHaveBeenCalledWith('customer_id', CUSTOMER_ID)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: CUSTOMER_ID })
    )
  })
})

describe('reorderStations', () => {
  it('updates every row to a negative placeholder sequence before applying final values', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' })

    const updateCalls: { sequence: number }[] = []
    const updateMock = jest.fn((payload: { sequence: number }) => {
      updateCalls.push(payload)
      return { eq: jest.fn().mockResolvedValue({ error: null }) }
    })

    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: () => ({ update: updateMock }),
    })

    await reorderStations([
      { id: validId(1), sequence: 2 },
      { id: validId(2), sequence: 1 },
    ])

    expect(updateCalls).toHaveLength(4)
    expect(updateCalls[0].sequence).toBeLessThan(0)
    expect(updateCalls[1].sequence).toBeLessThan(0)
    expect(updateCalls[2]).toEqual({ sequence: 2 })
    expect(updateCalls[3]).toEqual({ sequence: 1 })
  })
})

describe('upsertOrder', () => {
  const MEANWELL = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000001'
  const MARTINDALE = 'aaaaaaaa-aaaa-aaaa-aaaa-000000000002'
  const modelId = validId(20)
  const orderId = validId(21)

  const baseOrder = {
    orderNumber: 'PO-1',
    orderDate: '2026-07-01',
    dueDate: '2026-07-10',
    active: true,
    lines: [{ modelId, quantity: 5 }],
  }

  it('rejects a new order whose line item model belongs to a different customer', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'sup-1' }, role: 'supervisor' })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'models') {
          return { select: () => ({ in: async () => ({ data: [{ id: modelId, customer_id: MARTINDALE }], error: null }) }) }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    const result = await upsertOrder({ ...baseOrder, customerId: MEANWELL })
    expect(result.error).toMatch(/customer/i)
  })

  it('inserts a new order with the given customer_id when all lines match', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'sup-1' }, role: 'supervisor' })
    const insertMock = jest.fn().mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: orderId }, error: null }) }),
    })
    const lineInsertMock = jest.fn().mockResolvedValue({ error: null })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'models') {
          return { select: () => ({ in: async () => ({ data: [{ id: modelId, customer_id: MEANWELL }], error: null }) }) }
        }
        if (table === 'orders') return { insert: insertMock }
        if (table === 'order_lines') return { insert: lineInsertMock }
        throw new Error(`unexpected table ${table}`)
      },
    })

    await upsertOrder({ ...baseOrder, customerId: MEANWELL })

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ customer_id: MEANWELL }))
  })

  it('validates line items against the existing order\'s own customer on update, ignoring the client payload', async () => {
    ;(requireRole as jest.Mock).mockResolvedValue({ user: { id: 'sup-1' }, role: 'supervisor' })
    ;(createAdminClient as jest.Mock).mockReturnValue({
      from: (table: string) => {
        if (table === 'orders') {
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { customer_id: MEANWELL }, error: null }) }) }) }
        }
        if (table === 'models') {
          return { select: () => ({ in: async () => ({ data: [{ id: modelId, customer_id: MARTINDALE }], error: null }) }) }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })

    // Client claims Martindale, but the existing order is actually Meanwell — the
    // server must use the order's own (DB) customer, not this value, to validate lines.
    const result = await upsertOrder({ ...baseOrder, id: orderId, customerId: MARTINDALE })
    expect(result.error).toMatch(/customer/i)
  })
})
