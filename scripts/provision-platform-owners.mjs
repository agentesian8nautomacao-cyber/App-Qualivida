/**
 * Provisiona Platform Owners a partir de PLATFORM_OWNER_EMAILS.
 * NÃO imprime senhas. NÃO aceita senha por argumento.
 * NÃO commitar e-mails reais. Rodar somente em ambiente server-side seguro.
 *
 * Uso (manual):
 *   PLATFORM_OWNER_EMAILS=a@x.com,b@y.com node scripts/provision-platform-owners.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && process.env[key] == null) {
        process.env[key] = val;
      }
    }
  }
}

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  const keep = local.slice(0, 1);
  return `${keep}***@${domain}`;
}

loadEnv();

const emails = String(process.env.PLATFORM_OWNER_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
  .trim()
  .replace(/\/$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!emails.length) {
  console.error('Defina PLATFORM_OWNER_EMAILS no ambiente (não commitar valores reais).');
  process.exit(1);
}
if (!supabaseUrl || !serviceKey) {
  console.error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no servidor.');
  process.exit(1);
}
if (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Recusado: VITE_SUPABASE_SERVICE_ROLE_KEY não é permitido.');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

for (const email of emails) {
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: undefined
  });
  let userId = invited?.user?.id || null;
  if (inviteError) {
    const msg = String(inviteError.message || '');
    if (!/already|registered|exists/i.test(msg)) {
      console.error(maskEmail(email), 'invite_failed');
      continue;
    }
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = list?.users?.find((u) => (u.email || '').toLowerCase() === email)?.id || null;
  }
  if (!userId) {
    console.error(maskEmail(email), 'user_not_found');
    continue;
  }
  const { error: insertError } = await admin.from('platform_admins').insert({
    user_id: userId,
    role: 'platform_owner',
    status: 'active'
  });
  if (insertError) {
    const dup = String(insertError.code || '') === '23505' || /duplicate|unique/i.test(insertError.message || '');
    console.log(maskEmail(email), dup ? 'already_platform_admin' : 'insert_failed');
    continue;
  }
  console.log(maskEmail(email), 'provisioned', 'role=platform_owner');
}
