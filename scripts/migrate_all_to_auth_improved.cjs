#!/usr/bin/env node
/**
 * migrate_all_to_auth_improved.js
 *
 * Script para migrar registros de tabelas de domínio para Auth.users usando SERVICE_ROLE_KEY.
 * - Valida emails (formato e unicidade entre tabelas)
 * - Aborta e gera relatório se encontrar emails inválidos/duplicados/fictícios
 * - Quando todos válidos, cria usuários no Auth com senha temporária e email_confirm: true
 * - Atualiza a tabela de domínio com auth_user_id
 * - Gera um CSV seguro com mapping (email, auth_user_id, temp_password) para o operador notificar responsáveis
 *
 * Uso:
 * SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node migrate_all_to_auth_improved.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_TABLES = ['resident', 'residents', 'staff', 'users', 'funcionarios'];

function isValidEmail(e) {
  if (!e) return false;
  const s = String(e).trim().toLowerCase();
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(s);
}

function generateTempPassword(len = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const crypto = require('crypto');
  const buf = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return out;
}

async function collectRows() {
  const rows = [];
  for (const tbl of TARGET_TABLES) {
    try {
      const { data, error } = await supabase.from(tbl).select('*');
      if (error) {
        // Table may not exist — ignore
        continue;
      }
      if (data && data.length) {
        for (const r of data) {
          rows.push({ table: tbl, row: r });
        }
      }
    } catch (e) {
      // ignore errors per table
    }
  }
  return rows;
}

async function run() {
  console.log('Coletando registros das tabelas...', TARGET_TABLES.join(', '));
  const all = await collectRows();
  console.log(`Registros coletados: ${all.length}`);

  // Map email -> occurrences
  const emailMap = new Map();
  const invalids = [];

  for (const item of all) {
    const emailRaw = (item.row.email || '').toString().trim().toLowerCase();
    if (!emailRaw) {
      invalids.push({ reason: 'missing_email', ...item });
      continue;
    }
    if (!isValidEmail(emailRaw)) {
      invalids.push({ reason: 'invalid_format', ...item });
      continue;
    }
    const key = emailRaw;
    if (!emailMap.has(key)) emailMap.set(key, []);
    emailMap.get(key).push(item);
  }

  // detect duplicates across domain tables
  const duplicates = [];
  for (const [email, occurrences] of emailMap.entries()) {
    if (occurrences.length > 1) {
      duplicates.push({ email, occurrences });
    }
  }

  if (invalids.length > 0 || duplicates.length > 0) {
    console.error('Foram detectados problemas com emails. Abortando migração.');
    const report = {
      timestamp: new Date().toISOString(),
      invalids,
      duplicates
    };
    const outPath = path.resolve(process.cwd(), 'migration_email_issues_report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), { encoding: 'utf8' });
    console.error('Relatório gerado em:', outPath);
    console.error('Corrija os problemas (emails faltantes/invalidos/duplicados) antes de prosseguir.');
    process.exit(2);
  }

  // Ensure none already have auth_user_id set for target rows we'd process
  const toProcess = [];
  for (const [email, occurrences] of emailMap.entries()) {
    for (const item of occurrences) {
      const row = item.row;
      if (row.auth_user_id) {
        // already linked — skip
        continue;
      }
      toProcess.push({ table: item.table, id: row.id, email: email });
    }
  }

  console.log(`Registros a migrar (sem auth_user_id): ${toProcess.length}`);
  if (toProcess.length === 0) {
    console.log('Nenhum registro para migrar. Saindo.');
    process.exit(0);
  }

  // Final safety: check Auth for existing users with same email
  const existingAuth = new Map();
  try {
    // supabase.auth.admin.listUsers may paginate; use listUsers once and index by email
    const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      console.warn('Não foi possível listar usuários do Auth (listUsers). Prosseguindo com cautela.', listErr);
    } else {
      const usersList = listData?.users || listData || [];
      for (const u of usersList) {
        if (u.email) existingAuth.set(u.email.toString().toLowerCase(), u);
      }
    }
  } catch (e) {
    console.warn('Erro ao consultar auth list:', e);
  }

  const results = [];
  const csvLines = [['email','auth_user_id','temp_password','table','row_id']];

  for (const item of toProcess) {
    const { table, id, email } = item;
    try {
      // If auth already has user, link to existing auth user
      if (existingAuth.has(email)) {
        const found = existingAuth.get(email);
        const authId = found.id || found.user?.id;
        const { error: updateErr } = await supabase.from(table).update({ auth_user_id: authId }).eq('id', id);
        if (updateErr) {
          console.error(`Falha ao atualizar ${table}.id=${id} com auth_user_id=${authId}:`, updateErr);
          results.push({ table, id, email, status: 'update_failed', error: updateErr });
        } else {
          results.push({ table, id, email, status: 'linked_existing', auth_user_id: authId });
          csvLines.push([email, authId, '', table, id]);
        }
        continue;
      }

      // Create new auth user with temp password
      const tempPassword = generateTempPassword(12);
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true
      });
      if (createErr) {
        console.error(`Erro ao criar auth user para ${email}:`, createErr);
        results.push({ table, id, email, status: 'create_failed', error: createErr });
        continue;
      }
      const authUserId = (createData?.user?.id ?? createData?.id);
      if (!authUserId) {
        console.error(`createUser não retornou id para ${email}`);
        results.push({ table, id, email, status: 'no_auth_id' });
        continue;
      }

      // Update domain table
      const { error: updateError } = await supabase.from(table).update({ auth_user_id: authUserId, email }).eq('id', id);
      if (updateError) {
        console.error(`Falha ao atualizar ${table}.id=${id} com auth_user_id=${authUserId}:`, updateError);
        results.push({ table, id, email, status: 'update_failed', error: updateError });
        continue;
      }

      results.push({ table, id, email, status: 'created_and_linked', auth_user_id: authUserId });
      csvLines.push([email, authUserId, tempPassword, table, id]);
      // keep existingAuth map up to date
      existingAuth.set(email, { id: authUserId, email });
    } catch (e) {
      console.error('Erro inesperado ao migrar row:', e);
      results.push({ table: item.table, id: item.id, email: item.email, status: 'exception', error: String(e) });
    }
  }

  // Write CSV result
  const csvPath = path.resolve(process.cwd(), `migration_auth_results_${Date.now()}.csv`);
  const csvContent = csvLines.map(r => r.map(cell => `"${String(cell || '').replace(/"/g,'""')}"`).join(',')).join('\n');
  fs.writeFileSync(csvPath, csvContent, { encoding: 'utf8', mode: 0o600 });
  console.log('CSV com resultados gerado em:', csvPath);

  // Write JSON summary
  const summaryPath = path.resolve(process.cwd(), `migration_auth_summary_${Date.now()}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2), { encoding: 'utf8' });
  console.log('Resumo JSON gerado em:', summaryPath);

  console.log('Migração concluída. Reveja os arquivos CSV/JSON e notifique responsáveis com as senhas temporárias.');
  console.log('IMPORTANTE: As senhas temporárias estão apenas no CSV. Apague o arquivo após uso seguro.');
  process.exit(0);
}

run().catch(err => {
  console.error('Erro crítico na migração:', err);
  process.exit(2);
});

