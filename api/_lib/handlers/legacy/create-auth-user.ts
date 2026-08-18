/**
 * API serverless Vercel: cria usuário em auth.users (admin).
 * Usa SUPABASE_SERVICE_ROLE_KEY (nunca exposta ao client).
 * Chamada ao cadastrar staff/porteiro ou morador importado.
 */

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface Body {
  email: string;
  password?: string;
  emailConfirm?: boolean;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
        { status: 405, headers: corsHeaders }
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
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL devem estar definidos nas variáveis do Vercel.',
          code: 'CONFIG_MISSING',
        },
        { status: 500, headers: corsHeaders }
      );
    }

    let body: Partial<Body> = {};
    try {
      const raw = await request.json();
      body = (raw && typeof raw === 'object' ? raw : {}) as Partial<Body>;
    } catch {
      return Response.json(
        { error: 'Body inválido', code: 'BAD_REQUEST' },
        { status: 400, headers: corsHeaders }
      );
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: 'E-mail válido obrigatório', code: 'BAD_REQUEST' },
        { status: 400, headers: corsHeaders }
      );
    }

    const password =
      typeof body.password === 'string' && body.password.trim().length >= 6
        ? body.password.trim()
        : undefined;
    const emailConfirm = body.emailConfirm !== false;

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const adminSup = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await (adminSup.auth as any).admin.createUser({
        email,
        password: password || undefined,
        email_confirm: emailConfirm,
      });

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('already registered')) {
          try {
            const { data: list } = await adminSup.auth.admin.listUsers({ perPage: 1000 });
            const user = list?.users?.find((u: any) => u.email?.toLowerCase() === email);
            if (user?.id) {
              return Response.json(
                { auth_user_id: user.id, already_exists: true },
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch {
            /* ignora */
          }
        }
        return Response.json(
          { error: error.message || 'Erro ao criar usuário', code: 'AUTH_ERROR' },
          { status: 400, headers: corsHeaders }
        );
      }

      const authUserId = data?.user?.id ?? data?.id;
      if (!authUserId) {
        return Response.json(
          { error: 'Usuário criado mas ID não retornado', code: 'AUTH_ERROR' },
          { status: 500, headers: corsHeaders }
        );
      }

      return Response.json(
        { auth_user_id: authUserId },
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[create-auth-user]', msg);
      return Response.json(
        { error: msg || 'Erro interno', code: 'INTERNAL_ERROR' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
