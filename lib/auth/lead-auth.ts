import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'

export async function authenticateLead(
  name: string,
  password: string
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('id, password_hash')
    .eq('name', name)
    .eq('active', true)
    .single()

  if (!lead) return null
  const valid = await bcrypt.compare(password, lead.password_hash)
  return valid ? lead.id : null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
