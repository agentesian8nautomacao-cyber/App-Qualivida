#!/usr/bin/env node
/**
 * scripts/ensure_staff_roles_and_auth.js
 *
 * Usage:
 *   node ensure_staff_roles_and_auth.js SUPABASE_URL SERVICE_ROLE_KEY DEFAULT_PASSWORD
 *
 * What it does:
 * - Normaliza o campo `role` na tabela `staff` para valores padrão: ADMIN, SINDICO, DESENVOLVEDOR, PORTEIRO, MORADOR
 * - Propaga o papel padronizado para a tabela `users` (quando houver `auth_user_id`)
 * - Para registros com `auth_user_id` e `email`, chama o endpoint admin do Supabase Auth para confirmar o e‑mail e definir uma senha inicial (DEFAULT_PASSWORD)
 *
 * Segurança: requer SERVICE_ROLE_KEY (service_role) — rode apenas em ambiente seguro.
 */

import fetch from 'node-fetch';

const [,, SUPABASE_URL, SERVICE_ROLE_KEY, DEFAULT_PASSWORD] = process.argv;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DEFAULT_PASSWORD) {
  console.error('Usage: node ensure_staff_roles_and_auth.js SUPABASE_URL SERVICE_ROLE_KEY DEFAULT_PASSWORD');
  process.exit(1);
}

const baseUrl = SUPABASE_URL.replace(/\/$/, '');
const restUrl = `${baseUrl}/rest/v1`;
const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

function normalizeRole(raw) {
  if (!raw) return null;
  const r = String(raw).trim().toUpperCase();
  if (['ADMIN','ADMINISTRADOR','ADM'].includes(r)) return 'ADMIN';
  if (['SINDICO','SÍNDICO','SYNDIC','SYNDICUS'].includes(r)) return 'SINDICO';
  if (['DESENVOLVEDOR','DEV','DEVELOPER','DESENV'].includes(r)) return 'DESENVOLVEDOR';
  if (['PORTEIRO','PORTARIA','PORTEIRO/PORTARIA'].includes(r)) return 'PORTEIRO';
  if (['MORADOR','RESIDENT','RESIDENTE'].includes(r)) return 'MORADOR';
  return r; // leave as-is uppercase
}

async function fetchStaff() {
  const url = `${restUrl}/staff?select=id,auth_user_id,username,email,role`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to fetch staff: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function updateStaffRole(staffId, role) {
  const url = `${restUrl}/staff?id=eq.${staffId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ role })
  });
  if (!res.ok) {
    throw new Error(`Failed to update staff ${staffId}: ${res.status} ${await res.text()}`);
  }
  return true;
}

async function updateStaffAuthUserId(staffId, authUserId) {
  const url = `${restUrl}/staff?id=eq.${staffId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ auth_user_id: authUserId })
  });
  if (!res.ok) {
    throw new Error(`Failed to update staff.auth_user_id ${staffId}: ${res.status} ${await res.text()}`);
  }
  return true;
}

async function createAuthUser(email, password) {
  const url = `${baseUrl}/auth/v1/admin/users`;
  const body = { email, password, email_confirm: true };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to create auth user: ${res.status} ${text}`);
  }
  // Response should be JSON with user data; parse it
  try {
    return JSON.parse(text);
  } catch (e) {
    return { raw: text };
  }
}

async function updateUsersRoleByAuthId(authUserId, role) {
  const url = `${restUrl}/users?auth_user_id=eq.${authUserId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ role })
  });
  if (!res.ok) {
    throw new Error(`Failed to update users for auth ${authUserId}: ${res.status} ${await res.text()}`);
  }
  return true;
}

async function updateAuthUser(authUserId, email, password) {
  const url = `${baseUrl}/auth/v1/admin/users/${authUserId}`;
  const body = { email: email || undefined, password, email_confirm: true };
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text };
}

async function main() {
  try {
    console.log('Fetching staff rows...');
    const staff = await fetchStaff();
    console.log(`Found ${staff.length} staff rows.`);
    for (const s of staff) {
      const staffId = s.id;
      const authUserId = s.auth_user_id;
      const email = s.email;
      const username = s.username;
      const rawRole = s.role;

      const normalized = normalizeRole(rawRole) || 'PORTEIRO';
      console.log('---');
      console.log('staff id:', staffId, 'username:', username, 'email:', email, 'auth_user_id:', authUserId, 'rawRole:', rawRole, 'normalized:', normalized);

      // Update staff.role if different
      if ((rawRole || '').toUpperCase() !== normalized) {
        console.log(` -> updating staff.role => ${normalized}`);
        try { await updateStaffRole(staffId, normalized); } catch (err) { console.error('   WARN updateStaffRole failed:', err.message || err); }
      }

      // Propagate to users table when auth_user_id present
      if (authUserId) {
        try {
          console.log(` -> propagating role to users for auth_user_id ${authUserId}`);
          await updateUsersRoleByAuthId(authUserId, normalized);
        } catch (err) {
          console.error('   WARN updateUsersRoleByAuthId failed:', err.message || err);
        }
      } else {
        // No auth_user_id — attempt to create Auth user automatically if email is present
        if (email) {
          try {
            console.log(` -> no auth_user_id. Creating auth user for email ${email} ...`);
            const created = await createAuthUser(email, DEFAULT_PASSWORD);
            // created may contain 'id' or 'user' depending on response shape
            const newAuthId = created?.id || created?.user?.id || created?.user_id || null;
            if (newAuthId) {
              console.log(`   -> created auth user id: ${newAuthId}. Updating staff record...`);
              try { await updateStaffAuthUserId(staffId, newAuthId); } catch (err) { console.error('   WARN updateStaffAuthUserId failed:', err.message || err); }
              try { await updateUsersRoleByAuthId(newAuthId, normalized); } catch (err) { console.error('   WARN updateUsersRoleByAuthId failed after create:', err.message || err); }
            } else {
              console.warn('   -> created auth user but could not determine id from response:', created);
            }
          } catch (err) {
            console.error('   WARN createAuthUser failed:', err.message || err);
          }
        } else {
          console.warn(' -> no auth_user_id and no email: cannot create Auth user automatically. Please provide an email in staff/users table.');
        }
      }

      // Ensure auth user email confirmed and password set
      if (authUserId && email) {
        try {
          console.log(` -> updating auth user ${authUserId} (confirm email + set default password)`);
          const res = await updateAuthUser(authUserId, email, DEFAULT_PASSWORD);
          console.log('   -> auth update result:', res.status, res.body);
        } catch (err) {
          console.error('   WARN updateAuthUser failed:', err.message || err);
        }
        // small delay
        await new Promise(r => setTimeout(r, 300));
      } else if (authUserId && !email) {
        console.warn(' -> auth_user_id present but no email: cannot set password/confirm email. Update staff/users table with an email first.');
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();

