/**
 * Login Master — reutiliza Auth + /api/master/session.
 * Sem senha/e-mail no código. Sem service_role. Sem user_id do cliente.
 */

import { getMasterSession } from './masterApi';
import { supabase, isSupabasePlaceholder } from './supabase';

export type MasterLoginResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function loginMasterWithPassword(
  email: string,
  password: string
): Promise<MasterLoginResult> {
  if (isSupabasePlaceholder) {
    return { ok: false, status: 503, error: 'Supabase não configurado neste ambiente.' };
  }
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password
  });
  if (authError || !data.session?.access_token) {
    return { ok: false, status: 401, error: 'E-mail ou senha inválidos.' };
  }
  const session = await getMasterSession(data.session.access_token);
  if (!session.ok) {
    await supabase.auth.signOut();
    if (session.error.status === 403) {
      return {
        ok: false,
        status: 403,
        error: 'Acesso Master negado. Esta conta não é Platform Admin ativo.'
      };
    }
    if (session.error.status === 401) {
      return { ok: false, status: 401, error: 'Sessão inválida. Tente novamente.' };
    }
    return { ok: false, status: session.error.status, error: session.error.error };
  }
  return { ok: true };
}
