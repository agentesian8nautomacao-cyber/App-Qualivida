// scripts/migrate_missing_auth_user_id.js
// Node 18+ (ESM). Popula auth_user_id nas tabelas de domínio usando auth.users.
// Usage:
//   npm install pg
//   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate_missing_auth_user_id.js

import pg from 'pg';
import assert from 'assert';

const { Client } = pg;

const {
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
} = process.env;

assert(DATABASE_URL, 'DATABASE_URL is required');
assert(SUPABASE_URL, 'SUPABASE_URL is required');
assert(SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY is required');

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const tables = ['resident', 'staff', 'users', 'funcionarios'];

async function findAuthUserByEmail(email) {
  const res = await client.query('SELECT id, email FROM auth.users WHERE lower(email)=lower($1) LIMIT 1', [email]);
  return res.rows[0] || null;
}

async function createAuthUser(email, password) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users`;
  const payload = {
    email,
    password,
    email_confirm: true
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create user ${email}: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  // Supabase returns object with id at top-level for admin create
  return data;
}

function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function generateTempPassword() {
  // reasonable temporary strong password
  return 'Tmp#' + Math.random().toString(36).slice(2, 10) + 'A1!';
}

for (const table of tables) {
  console.log('Processing table', table);
  const res = await client.query(`SELECT id, email FROM public.${table} WHERE auth_user_id IS NULL`);
  for (const row of res.rows) {
    const { id, email } = row;
    if (!isValidEmail(email)) {
      console.warn(`Skipping ${table} id=${id} — invalid email: ${email}`);
      continue;
    }
    let authUser = await findAuthUserByEmail(email);
    if (!authUser) {
      const tempPassword = generateTempPassword();
      try {
        const created = await createAuthUser(email, tempPassword);
        // created may include id at created.id or similar shape; handle common cases
        const createdId = created?.id || created?.user?.id;
        if (!createdId) {
          throw new Error('Could not determine created user id response: ' + JSON.stringify(created));
        }
        authUser = { id: createdId, email };
        console.log(`Created auth user for ${email} -> ${authUser.id}`);
      } catch (err) {
        console.error('Create failed for', email, err.message);
        continue;
      }
    } else {
      console.log(`Found existing auth user for ${email} -> ${authUser.id}`);
    }
    try {
      await client.query(`UPDATE public.${table} SET auth_user_id = $1 WHERE id = $2`, [authUser.id, id]);
      console.log(`Updated ${table} id=${id} with auth_user_id=${authUser.id}`);
    } catch (err) {
      console.error(`Failed update ${table} id=${id}:`, err.message);
    }
  }
}

await client.end();
console.log('Migration finished');

