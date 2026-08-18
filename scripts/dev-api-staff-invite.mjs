/**
 * Servidor de desenvolvimento para as rotas /api/staff-invite e /api/accept-staff-invite.
 * Use quando rodar "npm run dev" (Vite) para que o link de convite funcione em localhost.
 * Rode em outro terminal: npm run dev:api
 * Ou use o script "dev:all" para subir front + API juntos.
 */

import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) process.env[key] = val;
    }
  }
}
loadEnv();

const PORT = Number(process.env.DEV_API_PORT) || 3001;
const hasServiceKey = !!((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
const hasSupabaseUrl = !!((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim());
if (!hasServiceKey || !hasSupabaseUrl) {
  console.warn('[dev-api] Aviso: SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL/VITE_SUPABASE_URL não definidos em .env ou .env.local.');
  console.warn('[dev-api] Defina essas variáveis para a API de convite funcionar. A tabela staff_invites deve existir no Supabase (rode a migração).');
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body, status = 200) {
  return {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function generateUsername(name) {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return normalized || 'user';
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  // SENTINELA API v1 foundation (Etapa 4 / G1) — health via dynamic import when available
  if (path === '/api/v1/health' && req.method === 'GET') {
    try {
      const healthUrl = pathToFileURL(join(root, 'api', 'v1', '_lib', 'handlers', 'health.ts')).href;
      const mod = await import(healthUrl);
      const handler = mod.default;
      const incoming = new Request(`http://localhost:${PORT}${req.url}`, { method: 'GET', headers: req.headers });
      const response = await handler.fetch(incoming);
      const buf = Buffer.from(await response.arrayBuffer());
      const headers = { 'Content-Type': response.headers.get('Content-Type') || 'application/json' };
      for (const [k, v] of response.headers.entries()) {
        if (k.toLowerCase() === 'content-type' || k.toLowerCase().startsWith('x-') || k.toLowerCase().startsWith('access-control')) {
          headers[k] = v;
        }
      }
      res.writeHead(response.status, headers);
      res.end(buf);
    } catch (err) {
      console.warn('[dev-api] /api/v1/health import failed (use vitest for full G1 coverage):', err?.message || err);
      res.writeHead(501, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'GATE_PENDING',
          message: 'Sentinela /api/v1/health requires TS loader in this Node process. Prefer: npm run test:run -- api/v1',
        },
      }));
    }
    return;
  }

  if (path === '/api/staff-invite' && req.method === 'GET') {
    const token = url.searchParams.get('token')?.trim();
    if (!token) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token obrigatório', code: 'BAD_REQUEST' }));
      return;
    }
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
    if (!serviceKey || !supabaseUrl) {
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Configuração indisponível. Defina SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL (ou VITE_SUPABASE_URL) no .env.local.',
        code: 'CONFIG_MISSING',
      }));
      return;
    }
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSup = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data, error } = await adminSup.from('staff_invites').select('email, role, expires_at, used_at').eq('token', token).maybeSingle();
      if (error) {
        console.error('[dev-api] staff-invite DB:', error.message, error.code);
        const msg = (error.message || '').toLowerCase().includes('does not exist')
          ? 'Tabela staff_invites não existe. Rode a migração no Supabase (supabase/migrations/20250225000000_staff_invites.sql).'
          : (error.message || 'Erro ao consultar convite');
        res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: msg, code: 'DB_ERROR' }));
        return;
      }
      if (!data) {
        res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Link inválido ou expirado', code: 'INVALID_TOKEN' }));
        return;
      }
      if (data.used_at) {
        res.writeHead(410, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Este convite já foi utilizado', code: 'ALREADY_USED' }));
        return;
      }
      const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
      if (Date.now() > expiresAt) {
        res.writeHead(410, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Este link expirou', code: 'EXPIRED' }));
        return;
      }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ email: data.email, role: data.role, expiresAt: data.expires_at }));
    } catch (err) {
      console.error('[dev-api] staff-invite', err);
      const msg = err?.message || 'Erro interno';
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg, code: 'INTERNAL_ERROR' }));
    }
    return;
  }

  if (path === '/api/accept-staff-invite' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Body inválido', code: 'BAD_REQUEST' }));
      return;
    }
    const token = (parsed.token || '').trim();
    const name = (parsed.name || '').trim();
    const password = (parsed.password || '').trim();
    if (!token) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token é obrigatório', code: 'BAD_REQUEST' }));
      return;
    }
    if (!name || name.length < 2) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Nome completo é obrigatório', code: 'BAD_REQUEST' }));
      return;
    }
    if (!password || password.length < 6) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres', code: 'BAD_REQUEST' }));
      return;
    }
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
    if (!serviceKey || !supabaseUrl) {
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Configuração indisponível.', code: 'CONFIG_MISSING' }));
      return;
    }
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSup = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: invite, error: inviteError } = await adminSup.from('staff_invites').select('id, email, role, expires_at, used_at').eq('token', token).maybeSingle();
      if (inviteError || !invite) {
        res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Link inválido ou expirado', code: 'INVALID_TOKEN' }));
        return;
      }
      if (invite.used_at) {
        res.writeHead(410, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Este convite já foi utilizado', code: 'ALREADY_USED' }));
        return;
      }
      const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
      if (Date.now() > expiresAt) {
        res.writeHead(410, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Este link expirou', code: 'EXPIRED' }));
        return;
      }
      const email = String(invite.email).trim().toLowerCase();
      const roleDb = invite.role === 'SINDICO' ? 'SINDICO' : 'PORTEIRO';
      const { data: authData, error: authError } = await adminSup.auth.admin.createUser({ email, password, email_confirm: true });
      if (authError) {
        const msg = String(authError.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered')) {
          res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Este e-mail já possui cadastro. Use "Esqueci minha senha" na tela de login.', code: 'EMAIL_EXISTS' }));
          return;
        }
        res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: authError.message || 'Erro ao criar conta', code: 'AUTH_ERROR' }));
        return;
      }
      const authUserId = authData?.user?.id ?? authData?.id;
      if (!authUserId) {
        res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erro ao criar usuário', code: 'AUTH_ERROR' }));
        return;
      }
      let username = generateUsername(name);
      let counter = 1;
      let finalUsername = username;
      for (let i = 0; i < 105; i++) {
        const { data: existing } = await adminSup.from('users').select('id').eq('username', finalUsername).maybeSingle();
        if (!existing) break;
        finalUsername = counter <= 100 ? `${username}_${counter}` : `${username}_${Date.now()}`;
        counter++;
      }
      const { error: userInsertError } = await adminSup.from('users').insert({
        username: finalUsername,
        role: roleDb,
        name,
        email,
        phone: null,
        is_active: true,
        auth_user_id: authUserId,
      });
      if (userInsertError) {
        const code = String(userInsertError?.code || '');
        const msg = String(userInsertError?.message || '').toLowerCase();
        if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
          const { error: updateErr } = await adminSup.from('users').update({ name, email, auth_user_id: authUserId, is_active: true }).eq('username', finalUsername);
          if (updateErr) {
            res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: updateErr.message || 'Erro ao vincular perfil', code: 'DB_ERROR' }));
            return;
          }
        } else {
          res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: userInsertError.message || 'Erro ao criar perfil', code: 'DB_ERROR' }));
          return;
        }
      }
      const staffRoleLabel = roleDb === 'SINDICO' ? 'Síndico' : 'Porteiro';
      await adminSup.from('staff').insert({
        name,
        role: staffRoleLabel,
        status: 'Ativo',
        shift: 'Comercial',
        phone: null,
        email,
        auth_user_id: authUserId,
      }).then(() => {}).catch((e) => console.warn('[dev-api] staff insert', e.message));
      await adminSup.from('staff_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Conta criada. Faça login com seu e-mail e senha.' }));
    } catch (err) {
      console.error('[dev-api] accept-staff-invite', err);
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'Erro interno', code: 'INTERNAL_ERROR' }));
    }
    return;
  }

  if (path === '/api/send-invite-email' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Body inválido', code: 'BAD_REQUEST', sent: false }));
      return;
    }
    const toEmail = (parsed.email || '').trim().toLowerCase();
    const inviteLink = (parsed.inviteLink || '').trim();
    const role = parsed.role || 'PORTEIRO';
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'E-mail válido é obrigatório', code: 'BAD_REQUEST', sent: false }));
      return;
    }
    if (!inviteLink || !inviteLink.startsWith('http')) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Link de convite inválido', code: 'BAD_REQUEST', sent: false }));
      return;
    }
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) {
      res.writeHead(503, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Envio de e-mail não configurado (RESEND_API_KEY).', code: 'CONFIG_MISSING', sent: false }));
      return;
    }
    const roleLabel = role === 'SINDICO' ? 'ADM' : 'Portaria';
    const from = (process.env.RESEND_FROM || 'SentinelaAUT <onboarding@resend.dev>').trim();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;"><p style="font-size: 16px;">Você foi convidado(a) a acessar o sistema como <strong>${roleLabel}</strong>.</p><p style="font-size: 14px; color: #52525b;">Clique no link abaixo para criar sua senha. O link expira em 7 dias.</p><p style="margin: 24px 0;"><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Acessar e criar minha conta</a></p><p style="font-size: 12px; color: #71717a;">Se o botão não funcionar, copie e cole no navegador:<br><span style="word-break: break-all;">${inviteLink}</span></p></body></html>`;
    try {
      const fetchRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from, to: [toEmail], subject: `Convite para acessar o sistema — ${roleLabel}`, html }),
      });
      const data = await fetchRes.json().catch(() => ({}));
      if (!fetchRes.ok) {
        res.writeHead(502, { ...cors, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: data?.message || data?.error || 'Falha ao enviar e-mail', code: 'SEND_FAILED', sent: false }));
        return;
      }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sent: true, message: 'E-mail enviado com sucesso.' }));
    } catch (err) {
      console.error('[dev-api] send-invite-email', err);
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'Erro ao enviar e-mail', code: 'INTERNAL_ERROR', sent: false }));
    }
    return;
  }

  if (path.startsWith('/api/master')) {
    try {
      const liveUrl = pathToFileURL(join(root, 'api', 'master', '_lib', 'live.ts')).href;
      const mod = await import(liveUrl);
      const handle = mod.handleLiveMasterRequest;
      const chunks = [];
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
        for await (const chunk of req) chunks.push(chunk);
      }
      const bodyBuf = chunks.length ? Buffer.concat(chunks) : undefined;
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v == null) continue;
        headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
      }
      const incoming = new Request(`http://localhost:${PORT}${req.url}`, {
        method: req.method,
        headers,
        body: bodyBuf ? new Uint8Array(bodyBuf) : undefined,
      });
      const response = await handle(incoming);
      const buf = Buffer.from(await response.arrayBuffer());
      const outHeaders = { 'Content-Type': response.headers.get('Content-Type') || 'application/json' };
      for (const [k, v] of response.headers.entries()) {
        if (
          k.toLowerCase() === 'content-type' ||
          k.toLowerCase().startsWith('x-') ||
          k.toLowerCase().startsWith('access-control')
        ) {
          outHeaders[k] = v;
        }
      }
      res.writeHead(response.status, outHeaders);
      res.end(buf);
    } catch (err) {
      console.error('[dev-api] /api/master', err);
      res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'Erro interno Master', code: 'INTERNAL_ERROR' }));
    }
    return;
  }

  res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND' }));
});

server.listen(PORT, 'localhost', () => {
  console.log(`[dev-api] Staff invite API rodando em http://localhost:${PORT}`);
  console.log(`[dev-api] GET /api/staff-invite, POST /api/accept-staff-invite, POST /api/send-invite-email`);
  console.log(`[dev-api] /api/master/* (session, dashboard, organizations)`);
});
