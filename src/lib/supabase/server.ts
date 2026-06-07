import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let _client: ReturnType<typeof createClient<Database>> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _anyClient: any = null

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!supabaseUrl)      throw new Error('NEXT_PUBLIC_SUPABASE_URL missing')
  if (!serviceRoleKey)   throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return { supabaseUrl, serviceRoleKey }
}

const clientOpts = {
  auth: { autoRefreshToken: false, persistSession: false },
}

/** Fully typed client — use for simple selects / inserts on single tables */
export function createSupabaseServiceClient() {
  if (_client) return _client
  const { supabaseUrl, serviceRoleKey } = getEnv()
  _client = createClient<Database>(supabaseUrl, serviceRoleKey, clientOpts)
  return _client
}

/**
 * Untyped client — use when you need PostgREST join syntax like
 * `.select('*, contact:contacts(*)')` that TypeScript can't resolve
 * without `supabase gen types`. All query results are `any`.
 */
export function createSupabaseServiceClientUntyped() {
  if (_anyClient) return _anyClient
  const { supabaseUrl, serviceRoleKey } = getEnv()
  _anyClient = createClient(supabaseUrl, serviceRoleKey, clientOpts)
  return _anyClient
}