'use server'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth/lead-auth'
import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'

// Server Actions have their thrown error messages redacted to a generic digest
// in production builds. Business/validation errors need to reach the user, so
// actions catch internally and return { error } instead of throwing.
type ActionResult = { error?: string }

async function toResult(fn: () => Promise<void>): Promise<ActionResult>
async function toResult<T extends object>(fn: () => Promise<T>): Promise<ActionResult & T>
async function toResult(fn: () => Promise<object | void>): Promise<ActionResult> {
  try {
    return { ...(await fn()) }
  } catch (e) {
    unstable_rethrow(e)
    return { error: e instanceof Error ? e.message : 'Something went wrong' }
  }
}

// ── Input validation ──────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(val: string, field: string) {
  if (!UUID_RE.test(val)) throw new Error(`Invalid ${field}`)
}

function assertDate(val: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val)))
    throw new Error(`Invalid ${field}`)
}

// ── Stations (admin only) ─────────────────────────────────────────────────────

export async function upsertStation(data: {
  id?: string
  name: string
  sequence: number
  active: boolean
  customerId: string
}): Promise<ActionResult> {
  return toResult(async () => {
  if (data.id) assertUuid(data.id, 'station id')
  assertUuid(data.customerId, 'customer id')
  await requireRole('admin')
  const supabase = createAdminClient()

  if (data.id) {
    const { error } = await supabase
      .from('stations')
      .update({ name: data.name, sequence: data.sequence, active: data.active })
      .eq('id', data.id)
    if (error) throw error
  } else {
    // Shift existing stations of the same customer at or above the insertion
    // sequence up by 1, highest first to avoid any ordering issues.
    const { data: toShift, error: fetchError } = await supabase
      .from('stations')
      .select('id, sequence')
      .eq('customer_id', data.customerId)
      .gte('sequence', data.sequence)
      .order('sequence', { ascending: false })
    if (fetchError) throw fetchError

    for (const s of toShift ?? []) {
      const { error: shiftError } = await supabase
        .from('stations').update({ sequence: s.sequence + 1 }).eq('id', s.id)
      if (shiftError) throw shiftError
    }

    const { error } = await supabase
      .from('stations')
      .insert({ name: data.name, sequence: data.sequence, active: data.active, customer_id: data.customerId })
    if (error) throw error
  }
  revalidatePath('/admin/stations')
  })
}

export async function deleteStation(id: string): Promise<ActionResult> {
  return toResult(async () => {
  assertUuid(id, 'station id')
  await requireRole('admin')
  const supabase = createAdminClient()

  // Read sequence + customer before deleting so we can re-gap remaining stations
  const { data: station, error: fetchError } = await supabase
    .from('stations')
    .select('sequence, customer_id')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!station) throw new Error('Station not found')

  const { error } = await supabase.from('stations').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') throw new Error('Cannot delete: station has historical production logs')
    throw error
  }

  // Close the gap — shift everything above (within the same customer) down by 1, lowest first
  const { data: following, error: followError } = await supabase
    .from('stations')
    .select('id, sequence')
    .eq('customer_id', station.customer_id)
    .gt('sequence', station.sequence)
    .order('sequence', { ascending: true })
  if (followError) throw followError

  for (const s of following ?? []) {
    const { error: shiftError } = await supabase
      .from('stations').update({ sequence: s.sequence - 1 }).eq('id', s.id)
    if (shiftError) throw shiftError
  }

  revalidatePath('/admin/stations')
  })
}

export async function reorderStations(updates: { id: string; sequence: number }[]): Promise<ActionResult> {
  return toResult(async () => {
  updates.forEach((u, i) => assertUuid(u.id, `updates[${i}].id`))
  await requireRole('admin')
  const supabase = createAdminClient()

  // Two-phase update: move every row to a unique negative placeholder sequence
  // first, so the final pass never collides with the (customer_id, sequence)
  // unique constraint mid-loop (e.g. swapping two adjacent stations).
  for (const [i, u] of updates.entries()) {
    const { error } = await supabase
      .from('stations').update({ sequence: -(i + 1) }).eq('id', u.id)
    if (error) throw error
  }

  for (const u of updates) {
    const { error } = await supabase
      .from('stations').update({ sequence: u.sequence }).eq('id', u.id)
    if (error) throw error
  }

  revalidatePath('/admin/stations')
  })
}

// ── Models ────────────────────────────────────────────────────────────────────

export async function upsertModel(data: {
  id?: string
  name: string
  active: boolean
  stationIds: string[]
  customerId: string
}): Promise<ActionResult> {
  return toResult(async () => {
  if (data.id) assertUuid(data.id, 'model id')
  assertUuid(data.customerId, 'customer id')
  data.stationIds.forEach((id, i) => assertUuid(id, `stationIds[${i}]`))
  await requireRole('supervisor')
  const supabase = createAdminClient()
  let modelId = data.id

  if (data.id) {
    const { error } = await supabase
      .from('models')
      .update({ name: data.name, active: data.active })
      .eq('id', data.id)
    if (error) throw error
  } else {
    const { data: inserted, error } = await supabase
      .from('models')
      .insert({ name: data.name, active: data.active, customer_id: data.customerId })
      .select('id')
      .single()
    if (error) throw error
    modelId = inserted.id
  }

  // Activate the selected stations first (non-destructive — if the deactivate below
  // fails, the model still has its correct stations rather than having none at all)
  if (data.stationIds.length > 0) {
    const { error: upsertError } = await supabase.from('model_station_config').upsert(
      data.stationIds.map(stationId => ({ model_id: modelId!, station_id: stationId, active: true })),
      { onConflict: 'model_id,station_id' }
    )
    if (upsertError) throw upsertError
  }

  // Deactivate configs not in the new selection — only on update (new models have no old rows)
  if (data.id) {
    const deactivateQuery = supabase
      .from('model_station_config')
      .update({ active: false })
      .eq('model_id', modelId!)

    const { error: deactivateError } = data.stationIds.length > 0
      ? await deactivateQuery.not('station_id', 'in', `(${data.stationIds.join(',')})`)
      : await deactivateQuery

    if (deactivateError) throw deactivateError
  }

  revalidatePath('/admin/models')
  })
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function upsertOrder(data: {
  id?: string
  orderNumber: string
  orderDate: string
  dueDate: string
  active: boolean
  customerId: string
  lines: { modelId: string; quantity: number }[]
}): Promise<ActionResult> {
  return toResult(async () => {
  if (data.id) assertUuid(data.id, 'order id')
  assertUuid(data.customerId, 'customer id')
  assertDate(data.orderDate, 'orderDate')
  assertDate(data.dueDate, 'dueDate')
  if (data.dueDate < data.orderDate) throw new Error('dueDate must be on or after orderDate')
  data.lines.forEach((l, i) => assertUuid(l.modelId, `lines[${i}].modelId`))
  await requireRole('supervisor')
  const supabase = createAdminClient()

  // The order's customer is immutable after creation, so on update the
  // authoritative value comes from the DB, not the client payload.
  let orderCustomerId = data.customerId
  if (data.id) {
    const { data: existingOrder, error: orderFetchError } = await supabase
      .from('orders').select('customer_id').eq('id', data.id).maybeSingle()
    if (orderFetchError) throw orderFetchError
    if (!existingOrder) throw new Error('Order not found')
    orderCustomerId = existingOrder.customer_id
  }

  if (data.lines.length > 0) {
    const modelIds = [...new Set(data.lines.map(l => l.modelId))]
    const { data: modelRows, error: modelError } = await supabase
      .from('models').select('id, customer_id').in('id', modelIds)
    if (modelError) throw modelError
    const mismatched = (modelRows ?? []).some(m => m.customer_id !== orderCustomerId)
    if (mismatched || (modelRows ?? []).length !== modelIds.length)
      throw new Error('All line items must belong to the order\'s customer')
  }

  if (data.id) {
    const orderId = data.id

    // Snapshot the IDs of currently active lines before touching anything.
    // We deactivate by these specific IDs after inserting new ones, so a failed
    // insert leaves the old lines intact rather than leaving the order empty.
    const { data: currentLines, error: fetchError } = await supabase
      .from('order_lines')
      .select('id')
      .eq('order_id', orderId)
      .eq('active', true)
    if (fetchError) throw fetchError
    const oldLineIds = (currentLines ?? []).map(l => l.id)

    const { error } = await supabase
      .from('orders')
      .update({
        order_number: data.orderNumber,
        order_date: data.orderDate,
        due_date: data.dueDate,
        active: data.active,
      })
      .eq('id', orderId)
    if (error) throw error

    // Insert new lines before deactivating old ones — if the insert fails the
    // order still has its previous lines active. Inactive rows are the audit trail;
    // all order_lines queries must filter WHERE active = true.
    if (data.lines.length > 0) {
      const { error: insertError } = await supabase.from('order_lines').insert(
        data.lines.map(l => ({ order_id: orderId, model_id: l.modelId, quantity: l.quantity, active: true }))
      )
      if (insertError) throw insertError
    }

    if (oldLineIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('order_lines')
        .update({ active: false })
        .in('id', oldLineIds)
      if (deactivateError) throw deactivateError
    }
  } else {
    const { data: inserted, error } = await supabase
      .from('orders')
      .insert({
        order_number: data.orderNumber,
        order_date: data.orderDate,
        due_date: data.dueDate,
        active: data.active,
        customer_id: data.customerId,
      })
      .select('id')
      .single()
    if (error) throw error
    const orderId = inserted.id

    if (data.lines.length > 0) {
      const { error: insertError } = await supabase.from('order_lines').insert(
        data.lines.map(l => ({ order_id: orderId, model_id: l.modelId, quantity: l.quantity, active: true }))
      )
      if (insertError) throw insertError
    }
  }

  revalidatePath('/admin/orders')
  })
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function upsertLead(data: {
  id?: string
  name: string
  // undefined = leave password unchanged; empty string throws; any non-empty string = set new password
  password?: string
  active: boolean
}): Promise<ActionResult> {
  return toResult(async () => {
  if (data.id) assertUuid(data.id, 'lead id')
  await requireRole('supervisor')
  const supabase = createAdminClient()

  if (data.id) {
    if (data.password !== undefined && data.password.length === 0)
      throw new Error('Password cannot be empty — omit the field to leave it unchanged')
    const passwordHash = data.password ? await hashPassword(data.password) : undefined
    const { error } = await supabase.from('leads').update({
      name: data.name,
      active: data.active,
      ...(passwordHash !== undefined && { password_hash: passwordHash }),
    }).eq('id', data.id)
    if (error) throw error
  } else {
    if (!data.password || data.password.length === 0)
      throw new Error('Password required for new leads')
    const password_hash = await hashPassword(data.password)
    const { error } = await supabase
      .from('leads')
      .insert({ name: data.name, password_hash, active: data.active })
    if (error) throw error
  }
  revalidatePath('/admin/leads')
  })
}

// ── User roles (Admin only) ───────────────────────────────────────────────────

export async function setUserRole(userId: string, role: 'supervisor' | 'admin'): Promise<ActionResult> {
  return toResult(async () => {
  assertUuid(userId, 'userId')
  await requireRole('admin')
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
  if (error) throw error
  revalidatePath('/admin/accounts')
  })
}

export async function removeUserRole(userId: string): Promise<ActionResult> {
  return toResult(async () => {
  assertUuid(userId, 'userId')
  const { user } = await requireRole('admin')
  if (userId === user.id) throw new Error('Cannot remove your own admin role')
  const supabase = createAdminClient()
  const { error } = await supabase.from('user_roles').delete().eq('user_id', userId)
  if (error) throw error
  revalidatePath('/admin/accounts')
  })
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  return toResult(async () => {
  assertUuid(userId, 'userId')
  const { user } = await requireRole('admin')
  if (userId === user.id) throw new Error('Cannot delete your own account')
  const supabase = createAdminClient()

  const { data, error: roleFetchError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()
  if (roleFetchError) throw roleFetchError
  if (data?.role === 'admin') throw new Error('Cannot delete an admin account')

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw error
  revalidatePath('/admin/accounts')
  })
}

export async function inviteUser(email: string): Promise<ActionResult & { userId?: string }> {
  return toResult(async () => {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Invalid email address')
  await requireRole('admin')
  const supabase = createAdminClient()
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email)
  if (error) throw error

  const { error: roleError } = await supabase
    .from('user_roles')
    .upsert({ user_id: data.user.id, role: 'supervisor' }, { onConflict: 'user_id' })
  if (roleError) throw roleError
  revalidatePath('/admin/accounts')
  return { userId: data.user.id }
  })
}
