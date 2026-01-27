import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const resendApiKey = process.env.RESEND_API_KEY || '';
const appUrl = (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) || process.env.APP_URL || process.env.VITE_APP_URL || '';
const resendFrom = process.env.RESEND_FROM || 'onboarding@resend.dev';

function getSupabase() {
  const url = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const base = url ? `https://${url}` : 'https://placeholder.supabase.co';
  const key = supabaseServiceKey || 'placeholder-key';
  return createClient(base, key);
}

export async function POST(request: Request) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status:204, headers: cors });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Método não permitido' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  let body: { emailOrUsername?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Body JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const emailOrUsername = typeof body?.emailOrUsername === 'string' ? body.emailOrUsername.trim() : '';
  if (!emailOrUsername) {
    return new Response(JSON.stringify({ success: false, message: 'Informe usuário ou email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const q = emailOrUsername.toLowerCase();

  if (!supabaseServiceKey || supabaseServiceKey === 'placeholder-key') {
    return new Response(JSON.stringify({
      success: false,
      message: 'Serviço de recuperação de senha não configurado. Configure SUPABASE_SERVICE_ROLE_KEY.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const supabase = getSupabase();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username, email, name')
    .or(`username.eq.${q},email.eq.${q}`)
    .eq('is_active', true)
    .maybeSingle();

  if (userError || !user || !user.email) {
    return new Response(JSON.stringify({
      success: true,
      message: 'Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (!resendApiKey || !appUrl) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Recuperação por e-mail não configurada. Configure RESEND_API_KEY e APP_URL no Vercel.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  const { randomBytes } = await import('crypto');
  const buf = randomBytes(32);
  const token = Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { error: tokenError } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: user.id,
      token,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

  if (tokenError) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Erro ao gerar token de recuperação. Tente novamente.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  }

  if (resendApiKey && appUrl) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      const resetLink = `${appUrl.replace(/\/$/, '')}/?reset=1&token=${encodeURIComponent(token)}`;
      await resend.emails.send({
        from: resendFrom,
        to: user.email,
        subject: 'Recuperação de senha – Gestão Condominial',
        html: `
          <p>Olá, ${user.name || user.username}!</p>
          <p>Foi solicitada a recuperação de senha para sua conta.</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:8px;">Redefinir senha</a></p>
          <p>Ou copie e cole no navegador:</p>
          <p style="word-break:break-all;color:#666;">${resetLink}</p>
          <p>O link expira em 24 horas. Se não solicitou, ignore este e-mail.</p>
        `,
      });
    } catch (e) {
      console.error('Resend send error:', e);
      return new Response(JSON.stringify({
        success: false,
        message: 'Erro ao enviar e-mail. Verifique RESEND_API_KEY e tente novamente.',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      });
    }
  }

  return new Response(JSON.stringify({
    success: true,
    message: 'Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação.',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}
