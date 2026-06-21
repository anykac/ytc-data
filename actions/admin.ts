'use server'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth/lead-auth'
import { revalidatePath } from 'next/cache'

// ── Input validation ──────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(val: string, field: string) {
  if (!UUID_RE.test(val)) throw new Error(`Invalid ${field}`)
}

function assertDate(val: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(Date.parse(val)))
    throw new Error(`Invalid ${field}`)
}

// ── Stations ──────────────────────────────────────────────────────────────────

export async function upsertStation(data: {
  id?: string
  name: string
  sequence: number
  active: boolean
}) {
  if (data.id) assertUuid(data.id, 'station id')
  await requireRole('supervisor')
  const supabase = createAdminClient()

  if (data.id) {
    const { error } = await supabase
      .from('stations')
      .update({ name: data.name, sequence: data.sequence, active: data.active })
      .eq('id', data.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('stations')
      .insert({ name: data.name, sequence: data.sequence, active: data.active })
    if (error) throw error
  }
  revalidatePath('/admin/stations')
}

// ── Models ────────────────────────────────────────────────────────────────────

export async function upsertModel(data: {
  id?: string
  name: string
  active: boolean
  stationIds: string[]
}) {
  if (data.id) assertUuid(data.id, 'model id')
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
      .insert({ name: data.name, active: data.active })
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
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function upsertOrder(data: {
  id?: string
  orderNumber: string
  orderDate: string
  dueDate: string
  active: boolean
  lines: { modelId: string; quantity: number }[]
}) {
  if (data.id) assertUuid(data.id, 'order id')
  assertDate(data.orderDate, 'orderDate')
  assertDate(data.dueDate, 'dueDate')
  if (data.dueDate < data.orderDate) throw new Error('dueDate must be on or after orderDate')
  data.lines.forEach((l, i) => assertUuid(l.modelId, `lines[${i}].modelId`))
  await requireRole('supervisor')
  const supabase = createAdminClient()

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
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function upsertLead(data: {
  id?: string
  name: string
  // undefined = leave password unchanged; empty string throws; any non-empty string = set new password
  password?: string
  active: boolean
}) {
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
}

// ── User roles (Admin only) ───────────────────────────────────────────────────

export async function setUserRole(userId: string, role: 'supervisor' | 'admin') {
  assertUuid(userId, 'userId')
  await requireRole('admin')
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
  if (error) throw error
  revalidatePath('/admin/accounts')
}

export async function removeUserRole(userId: string) {
  assertUuid(userId, 'userId')
  const { user } = await requireRole('admin')
  if (userId === user.id) throw new Error('Cannot remove your own admin role')
  const supabase = createAdminClient()
  const { error } = await supabase.from('user_roles').delete().eq('user_id', userId)
  if (error) throw error
  revalidatePath('/admin/accounts')
}
