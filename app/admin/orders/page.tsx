import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import OrdersAdmin from './OrdersAdmin'

export default async function OrdersPage() {
  await requireRole('supervisor')
  const supabase = createAdminClient()
  const [{ data: orders, error: oe }, { data: models, error: me }] = await Promise.all([
    supabase.from('orders').select('id, order_number, order_date, due_date, active').order('order_number'),
    supabase.from('models').select('id, name').eq('active', true).order('name'),
  ])
  if (oe) throw oe
  if (me) throw me

  const orderIds = (orders ?? []).map((o) => o.id)
  const { data: lines, error: le } = orderIds.length > 0
    ? await supabase.from('order_lines').select('order_id, model_id, quantity, models!inner(name)').in('order_id', orderIds).eq('active', true)
    : { data: [], error: null }
  if (le) throw le

  return <OrdersAdmin orders={orders ?? []} models={models ?? []} lines={lines ?? []} />
}
