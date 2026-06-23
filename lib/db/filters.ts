import { createAdminClient } from '@/lib/supabase/admin'

export type ActiveOrder = { id: string; order_number: string }
export type ActiveModel = { id: string; name: string }

export async function getActiveOrders(): Promise<ActiveOrder[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('active', true)
    .order('order_number')
  if (error) throw error
  return data ?? []
}

/** Returns models scoped to a specific order, or all active models if no orderId. */
export async function getFilteredModels(orderId?: string): Promise<ActiveModel[]> {
  const supabase = createAdminClient()
  if (orderId) {
    const { data, error } = await supabase
      .from('order_lines')
      .select('model_id, models!inner(id, name)')
      .eq('active', true)
      .eq('order_id', orderId)
    if (error) throw error
    // Deduplicate in case an order has multiple lines for the same model
    const seen = new Set<string>()
    return (data ?? [])
      .map((r) => r.models as ActiveModel)
      .filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  const { data, error } = await supabase
    .from('models')
    .select('id, name')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

/** Resolves the modelIds to pass to dashboard queries from URL params. */
export async function resolveModelIds(orderId?: string, modelId?: string): Promise<string[] | undefined> {
  if (modelId) return [modelId]
  if (orderId) {
    const models = await getFilteredModels(orderId)
    return models.map((m) => m.id)
  }
  return undefined
}
