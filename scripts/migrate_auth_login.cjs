#!/usr/bin/env node
/**
 * migrate_auth_login.cjs
 *
 * Migra usuários de users, staff e residents para auth.users para habilitar login.
 * Usa senha padrão configurável (env MIGRATE_DEFAULT_PASSWORD, default: 123456).
 *
 * Uso:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/migrate_auth_login.cjs
 *   MIGRATE_DEFAULT_PASSWORD=senha123 node scripts/migrate_auth_login.cjs  # senha customizada
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_PASSWORD = process.env.MIGRATE_DEFAULT_PASSWORD || '123456';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Ex.: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate_auth_login.cjs');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function isValidEmail(e) {
  if (!e) return false;
  const s = String(e).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function listAllAuthUsers() {
  const map = new Map();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.warn('Erro ao listar auth.users:', error.message);
      break;
    }
    const users = data?.users || [];
    for (const u of users) {
      if (u.email) map.set(u.email.toLowerCase(), { id: u.id, email: u.email });
    }
    if (users.length < perPage) break;
    page++;
  }
  return map;
}

async function processTable(tableName) {
  let rows = [];
  try {
    const { data, error } = await supabase.from(tableName).select('id, email, auth_user_id');
    if (error) {
      console.warn(`  Tabela ${tableName} não encontrada ou sem acesso:`, error.message);
      return { created: 0, linked: 0, skipped: 0 };
    }
    rows = data || [];
  } catch (e) {
    console.warn(`  Erro ao ler ${tableName}:`, e.message);
    return { created: 0, linked: 0, skipped: 0 };
  }

  let created = 0, linked = 0, skipped = 0;
  const authMap = await listAllAuthUsers();

  for (const row of rows) {
    const email = (row.email || '').toString().trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      skipped++;
      continue;
    }
    if (row.auth_user_id) {
      skipped++;
      continue;
    }

    if (authMap.has(email)) {
      const authUser = authMap.get(email);
      const { error: updateErr } = await supabase
        .from(tableName)
        .update({ auth_user_id: authUser.id })
        .eq('id', row.id);
      if (updateErr) {
        console.warn(`  Falha ao vincular ${tableName}.id=${row.id}:`, updateErr.message);
      } else {
        linked++;
        console.log(`  [${tableName}] Vinculado: ${email} -> ${authUser.id}`);
      }
      continue;
    }

    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true
    });

    if (createErr) {
      if (String(createErr.message || '').toLowerCase().includes('already') || 
          String(createErr.message || '').toLowerCase().includes('registered')) {
        const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const found = (listData?.users || []).find(u => (u.email || '').toLowerCase() === email);
        if (found) {
          authMap.set(email, { id: found.id, email });
          const { error: upd } = await supabase.from(tableName).update({ auth_user_id: found.id }).eq('id', row.id);
          if (!upd) { linked++; console.log(`  [${tableName}] Vinculado (já existia no Auth): ${email}`); }
        }
      } else {
        console.warn(`  Erro ao criar auth user ${email}:`, createErr.message);
      }
      continue;
    }

    const authId = createData?.user?.id ?? createData?.id;
    if (!authId) {
      console.warn(`  createUser não retornou id para ${email}`);
      continue;
    }

    const { error: updateErr } = await supabase
      .from(tableName)
      .update({ auth_user_id: authId })
      .eq('id', row.id);

    if (updateErr) {
      console.warn(`  Falha ao atualizar ${tableName}.id=${row.id}:`, updateErr.message);
    } else {
      created++;
      authMap.set(email, { id: authId, email });
      console.log(`  [${tableName}] Criado e vinculado: ${email} (senha: ${DEFAULT_PASSWORD})`);
    }
  }

  return { created, linked, skipped };
}

async function run() {
  console.log('Migração de usuários para auth.users');
  console.log('Senha padrão para novos usuários:', DEFAULT_PASSWORD);
  console.log('---\n');

  const tables = ['users', 'staff', 'residents'];
  let totalCreated = 0, totalLinked = 0;

  for (const t of tables) {
    console.log(`Processando ${t}...`);
    const r = await processTable(t);
    totalCreated += r.created;
    totalLinked += r.linked;
    console.log(`  Resultado: ${r.created} criados, ${r.linked} vinculados, ${r.skipped} ignorados\n`);
  }

  console.log('---');
  console.log(`Total: ${totalCreated} usuários criados em auth.users, ${totalLinked} vinculados a registros existentes.`);
  console.log('Senha para novos usuários:', DEFAULT_PASSWORD);
  console.log('Peça aos usuários que troquem a senha em "Esqueci minha senha" ou no primeiro acesso.');
  process.exit(0);
}

run().catch(err => {
  console.error('Erro:', err);
  process.exit(2);
});
