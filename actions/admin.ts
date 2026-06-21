'use server'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashPassword } from '@/lib/auth/lead-auth'
import { revalidatePath } from 'next/cache'

// ── Stations ──────────────────────────────────────────────────────────────────

export async function upsertStation(data: {
  id?: string
  name: string
  sequence: number
  active: boolean
}) {
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

  const { error: deactivateError } = await supabase
    .from('model_station_config')
    .update({ active: false })
    .eq('model_id', modelId!)
  if (deactivateError) throw deactivateError

  if (data.stationIds.length > 0) {
    const { error: upsertError } = await supabase.from('model_station_config').upsert(
      data.stationIds.map(stationId => ({ model_id: modelId!, station_id: stationId, active: true })),
      { onConflict: 'model_id,station_id' }
    )
    if (upsertError) throw upsertError
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
  await requireRole('supervisor')
  const supabase = createAdminClient()
  let orderId = data.id

  if (data.id) {
    const { error } = await supabase
      .from('orders')
      .update({
        order_number: data.orderNumber,
        order_date: data.orderDate,
        due_date: data.dueDate,
        active: data.active,
      })
      .eq('id', data.id)
    if (error) throw error

    // Soft-deactivate existing lines before inserting the replacement set
    const { error: deactivateError } = await supabase
      .from('order_lines')
      .update({ active: false })
      .eq('order_id', data.id)
    if (deactivateError) throw deactivateError
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
    orderId = inserted.id
  }

  if (data.lines.length > 0) {
    const { error } = await supabase.from('order_lines').insert(
      data.lines.map(l => ({ order_id: orderId!, model_id: l.modelId, quantity: l.quantity, active: true }))
    )
    if (error) throw error
  }
  revalidatePath('/admin/orders')
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function upsertLead(data: {
  id?: string
  name: string
  password?: string
  active: boolean
}) {
  await requireRole('supervisor')
  const supabase = createAdminClient()

  if (data.id) {
    const passwordHash = data.password ? await hashPassword(data.password) : undefined
    const { error } = await supabase.from('leads').update({
      name: data.name,
      active: data.active,
      ...(passwordHash !== undefined && { password_hash: passwordHash }),
    }).eq('id', data.id)
    if (error) throw error
  } else {
    if (!data.password) throw new Error('Password required for new leads')
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
  await requireRole('admin')
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
  if (error) throw error
  revalidatePath('/admin/accounts')
}

export async function removeUserRole(userId: string) {
  await requireRole('admin')
  const supabase = createAdminClient()
  const { error } = await supabase.from('user_roles').delete().eq('user_id', userId)
  if (error) throw error
  revalidatePath('/admin/accounts')
}
