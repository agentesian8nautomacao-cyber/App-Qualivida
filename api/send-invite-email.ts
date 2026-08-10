/**
 * API: POST /api/send-invite-email
 * Body: { email: string, inviteLink: string, role: string }
 *
 * Envio feito exclusivamente no backend via Resend.
 * Variáveis: RESEND_API_KEY, RESEND_FROM ou APP_SENDER_EMAIL (domínio verificado).
 */

export const runtime = 'nodejs';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getFrom(): string {
  const from =
    (process.env.RESEND_FROM || process.env.APP_SENDER_EMAIL || 'Qualivida <no-reply@phmsdev.com.br>').trim();
  return from;
}

function errMessage(err: unknown): string {
  if (err == null) return 'Erro desconhecido ao enviar e-mail.';
  if (err instanceof Error) return err.message;
  const o = err as Record<string, unknown>;
  if (typeof o?.message === 'string') return o.message;
  if (Array.isArray(o?.errors) && o.errors[0] && typeof (o.errors[0] as any)?.message === 'string')
    return (o.errors[0] as any).message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

const DOMAIN_NOT_VERIFIED_MSG =
  'A API key do Resend não está associada a um domínio verificado. No painel do Resend (resend.com): (1) vá em Domains e verifique o domínio do remetente (ex: phmsdev.com.br) com os registros DNS, ou (2) crie uma nova API Key com "Full access" e use essa key na variável RESEND_API_KEY na Vercel. Depois faça redeploy.';

export default {
  async fetch(request: Request): Promise<Response> {
    const json = (obj: Record<string, unknown>, status: number) =>
      Response.json(obj, { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
    }

    try {
      const apiKey = (process.env.RESEND_API_KEY || '').trim();
      console.log('[send-invite-email] RESEND_API_KEY definida:', !!apiKey, '| from:', getFrom());

      if (!apiKey) {
        console.error('[send-invite-email] RESEND_API_KEY não configurada.');
        return json(
          { error: 'Envio de e-mail não configurado (RESEND_API_KEY).', code: 'CONFIG_MISSING', sent: false },
          503
        );
      }

      let body: { email?: string; inviteLink?: string; role?: string } = {};
      try {
        const raw = await request.json();
        body = (raw && typeof raw === 'object' ? raw : {}) as typeof body;
      } catch {
        return json({ error: 'Body inválido', code: 'BAD_REQUEST', sent: false }, 400);
      }

      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      let inviteLink = typeof body.inviteLink === 'string' ? body.inviteLink.trim() : '';
      const role = typeof body.role === 'string' ? body.role : 'PORTEIRO';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'E-mail válido é obrigatório', code: 'BAD_REQUEST', sent: false }, 400);
      }

      if (inviteLink && inviteLink.startsWith('/')) {
        let base =
          request.headers.get('origin') ||
          request.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
          '';
        if (!base && process.env.VITE_APP_URL) base = String(process.env.VITE_APP_URL).replace(/\/$/, '');
        if (!base && process.env.VERCEL_URL) base = `https://${String(process.env.VERCEL_URL).replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
        inviteLink = base ? `${base}${inviteLink}` : inviteLink;
      }

      if (!inviteLink || !inviteLink.startsWith('http')) {
        return json({ error: 'Link de convite inválido', code: 'BAD_REQUEST', sent: false }, 400);
      }

      const isResident = (role || '').toString().toUpperCase() === 'MORADOR';
      const roleLabel = isResident ? 'Morador' : role === 'SINDICO' ? 'ADM' : 'Portaria';
      const introText = isResident
        ? 'Você foi convidado(a) a acessar o sistema de gestão do condomínio como <strong>Morador</strong>.'
        : `Você foi convidado(a) a acessar o sistema de gestão do condomínio como <strong>${roleLabel}</strong>.`;
      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
  <p style="font-size: 16px;">${introText}</p>
  <p style="font-size: 14px; color: #52525b;">Clique no link abaixo para criar sua senha e ativar sua conta. O link expira em 7 dias.</p>
  <p style="margin: 24px 0;"><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #18181b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Acessar e criar minha conta</a></p>
  <p style="font-size: 12px; color: #71717a;">Se o botão não funcionar, copie e cole no navegador:<br><span style="word-break: break-all;">${inviteLink}</span></p>
  <p style="font-size: 12px; color: #a1a1aa; margin-top: 32px;">Qualivida Gestão — Este e-mail foi enviado automaticamente.</p>
</body>
</html>`;

      console.log('[send-invite-email] Antes do envio — to:', email, 'role:', roleLabel);

      const { Resend } = await import('resend');
      const resend = new Resend(apiKey);
      const from = getFrom();

      const { data, error } = await resend.emails.send({
        from,
        to: [email],
        subject: `Convite para acessar o sistema — ${roleLabel}`,
        html,
      });

      if (error) {
        console.error('[send-invite-email] ERRO RESEND:', JSON.stringify(error));
        const raw = errMessage(error);
        const isDomainNotVerified =
          /associated domain.*not verified|api key.*not verified|create a new api key|verified domain/i.test(raw);
        const msg = isDomainNotVerified ? DOMAIN_NOT_VERIFIED_MSG : raw;
        return json({ error: msg, code: isDomainNotVerified ? 'DOMAIN_NOT_VERIFIED' : 'SEND_FAILED', sent: false }, 500);
      }

      console.log('[send-invite-email] EMAIL ENVIADO. id:', data?.id);
      return json({ sent: true, message: 'E-mail enviado com sucesso.' }, 200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[send-invite-email] Exceção:', err);
      return json(
        {
          error: msg || 'Erro interno ao enviar e-mail.',
          code: 'INTERNAL_ERROR',
          sent: false,
        },
        500
      );
    }
  },
};
