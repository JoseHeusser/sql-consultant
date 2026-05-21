// Server-side Supabase client used by the /api/query route.
// We use the service_role key BUT only to query a single restricted view/role
// that is read-only. The LLM-generated SQL can never modify data.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getSupabase() {
  if (!url || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Execute arbitrary SELECT SQL by calling a stored function `run_query`
 * that we'll create on the database side. The function:
 *   - Runs the SQL inside a transaction with SET LOCAL ROLE readonly
 *   - Returns rows as JSON
 *   - Rejects anything other than SELECT/WITH
 * This is the safe path for LLM-generated queries.
 */
export async function runReadOnlyQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('run_query', { query_text: sql });
  if (error) return { rows: [], error: error.message };
  return { rows: (data as Record<string, unknown>[]) ?? [] };
}
