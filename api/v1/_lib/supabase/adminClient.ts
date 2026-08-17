/**
 * Server-only Supabase admin client (G7-A).
 * NEVER import from frontend / Vite bundles.
 * NEVER expose service role to the client.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ServerSupabaseEnv = {
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

/**
 * Creates a service-role Supabase client for API/server runtimes.
 * Returns null if credentials are missing (fail-closed — no anon fallback, no memory).
 */
export function createServerSupabaseClient(
  env: ServerSupabaseEnv | NodeJS.ProcessEnv = process.env
): SupabaseClient | null {
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (!serviceKey || !supabaseUrl) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
