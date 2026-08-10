/**
 * API: POST /api/accept-resident-invite
 * Body: { token: string, name: string, unit: string, password: string }
 * Valida o convite, cria usuário em auth.users, registra em residents, marca convite como usado.
 */

export const runtime = 'nodejs';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceKey =
      typeof process.env.SUPABASE_SERVICE_ROLE_KEY === 'string'
        ? process.env.SUPABASE_SERVICE_ROLE_KEY.trim()
        : '';
    const supabaseUrl =
      typeof process.env.SUPABASE_URL === 'string'
        ? process.env.SUPABASE_URL.trim().replace(/\/$/, '')
        : process.env.VITE_SUPABASE_URL?.toString().trim().replace(/\/$/, '') || '';

    if (!serviceKey || !supabaseUrl) {
      return Response.json(
        { error: 'Configuração indisponível.', code: 'CONFIG_MISSING' },
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body: { token?: string; name?: string; unit?: string; password?: string } = {};
    try {
      const raw = await request.json();
      body = (raw && typeof raw === 'object' ? raw : {}) as typeof body;
    } catch {
      return Response.json(
        { error: 'Body inválido', code: 'BAD_REQUEST' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!token) {
      return Response.json(
        { error: 'Token é obrigatório', code: 'BAD_REQUEST' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!name || name.length < 2) {
      return Response.json(
        { error: 'Nome completo é obrigatório', code: 'BAD_REQUEST' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!unit || unit.length < 1) {
      return Response.json(
        { error: 'Unidade é obrigatória', code: 'BAD_REQUEST' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!password || password.length < 6) {
      return Response.json(
        { error: 'Senha deve ter no mínimo 6 caracteres', code: 'BAD_REQUEST' },
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSup = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: invite, error: inviteError } = await adminSup
        .from('resident_invites')
        .select('id, email, expires_at, used_at')
        .eq('token', token)
        .maybeSingle();

      if (inviteError || !invite) {
        return Response.json(
          { error: 'Link inválido ou expirado', code: 'INVALID_TOKEN' },
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (invite.used_at) {
        return Response.json(
          { error: 'Este convite já foi utilizado', code: 'ALREADY_USED' },
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : 0;
      if (Date.now() > expiresAt) {
        return Response.json(
          { error: 'Este link expirou', code: 'EXPIRED' },
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const email = String(invite.email).trim().toLowerCase();

      let authUserId: string | null = null;
      const { data: authData, error: authError } = await (adminSup.auth as any).admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        const msg = String(authError.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered')) {
          const { data: list } = await (adminSup.auth as any).admin.listUsers({ perPage: 1000 });
          const existingUser = list?.users?.find((u: any) => String(u.email || '').toLowerCase() === email);
          if (existingUser?.id) {
            const { error: updateErr } = await (adminSup.auth as any).admin.updateUserById(existingUser.id, { password });
            if (updateErr) {
              return Response.json(
                { error: 'Este e-mail já possui cadastro. Use "Esqueci minha senha" na tela de login.', code: 'EMAIL_EXISTS' },
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            authUserId = existingUser.id;
          }
          if (!authUserId) {
            return Response.json(
              { error: 'Este e-mail já possui cadastro. Use "Esqueci minha senha" na tela de login.', code: 'EMAIL_EXISTS' },
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          return Response.json(
            { error: authError.message || 'Erro ao criar conta', code: 'AUTH_ERROR' },
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        authUserId = authData?.user?.id ?? authData?.id ?? null;
      }

      if (!authUserId) {
        return Response.json(
          { error: 'Erro ao criar usuário', code: 'AUTH_ERROR' },
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: residentError } = await adminSup.from('residents').insert({
        name,
        unit,
        email,
        phone: null,
        whatsapp: null,
        auth_user_id: authUserId,
      });

      if (residentError) {
        const code = String((residentError as any)?.code || '');
        const msg = String((residentError as any)?.message || '').toLowerCase();
        if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
          await adminSup
            .from('residents')
            .update({ name, unit, email, auth_user_id: authUserId })
            .eq('auth_user_id', authUserId);
        } else {
          return Response.json(
            { error: residentError.message || 'Erro ao criar perfil de morador', code: 'DB_ERROR' },
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      await adminSup
        .from('resident_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', invite.id);

      return Response.json(
        { success: true, message: 'Conta criada. Faça login com seu e-mail e senha.' },
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[accept-resident-invite]', msg);
      return Response.json(
        { error: msg || 'Erro interno', code: 'INTERNAL_ERROR' },
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
