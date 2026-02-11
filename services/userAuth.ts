import { supabase } from './supabase';

// Interface para dados do usuário
export interface User {
  id: string;
  username: string;
  // Usar string genérico para suportar múltiplos papéis (MORADOR, PORTEIRO, SINDICO, DESENVOLVEDOR, etc.)
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

// Configurações de segurança
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MINUTES = 15;

// Interface para tentativas de login
interface LoginAttempts {
  count: number;
  blockedUntil: number | null;
  lastAttempt: number;
}

/**
 * Obtém ou cria registro de tentativas para um usuário
 */
const getLoginAttempts = (username: string): LoginAttempts => {
  try {
    const stored = localStorage.getItem(`login_attempts_${username.toLowerCase()}`);
    if (stored) {
      const attempts: LoginAttempts = JSON.parse(stored);
      // Se o bloqueio expirou, resetar
      if (attempts.blockedUntil && Date.now() > attempts.blockedUntil) {
        return { count: 0, blockedUntil: null, lastAttempt: 0 };
      }
      return attempts;
    }
  } catch (error) {
    console.error('Erro ao ler tentativas de login:', error);
  }
  return { count: 0, blockedUntil: null, lastAttempt: 0 };
};

/**
 * Incrementa contador de tentativas falhas
 */
const incrementFailedAttempts = (username: string): LoginAttempts => {
  const attempts = getLoginAttempts(username);
  const newCount = attempts.count + 1;
  const blockedUntil = newCount >= MAX_LOGIN_ATTEMPTS 
    ? Date.now() + (BLOCK_DURATION_MINUTES * 60 * 1000)
    : null;

  const newAttempts: LoginAttempts = {
    count: newCount,
    blockedUntil,
    lastAttempt: Date.now()
  };

  try {
    localStorage.setItem(`login_attempts_${username.toLowerCase()}`, JSON.stringify(newAttempts));
  } catch (error) {
    console.error('Erro ao salvar tentativas de login:', error);
  }

  return newAttempts;
};

/**
 * Reseta tentativas de login (usado após login bem-sucedido)
 */
const resetLoginAttempts = (username: string): void => {
  try {
    localStorage.removeItem(`login_attempts_${username.toLowerCase()}`);
  } catch (error) {
    console.error('Erro ao resetar tentativas de login:', error);
  }
};

/**
 * Verifica se o usuário está bloqueado
 */
export const isUserBlocked = (username: string): { blocked: boolean; remainingMinutes?: number } => {
  const attempts = getLoginAttempts(username);
  
  if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
    const remainingMs = attempts.blockedUntil - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    return { blocked: true, remainingMinutes };
  }

  return { blocked: false };
};

/**
 * Verifica regra simplificada da senha: 6 a 32 caracteres, apenas letras e números (pelo menos uma letra e um número).
 * Maiúsculas e minúsculas são diferenciadas.
 */
const isStrongPassword = (password: string): boolean => {
  // Regras ajustadas: aceitar senhas numéricas (ex: 123456) e alfanuméricas.
  // Apenas aceitar caracteres alfanuméricos e comprimento entre 6 e 32.
  if (!password || password.length < 6 || password.length > 32) return false;
  if (!/^[A-Za-z0-9]+$/.test(password)) return false;
  return true;
};

/**
 * Valida credenciais de usuário (PORTEIRO/SINDICO) no Supabase
 * @param username Nome de usuário
 * @param password Senha em texto plano
 * @returns Objeto com resultado do login e informações de bloqueio
 */
export const loginUser = async (
  username: string, 
  password: string
): Promise<{ 
  user: User | null; 
  error: string | null; 
  blocked?: boolean; 
  remainingMinutes?: number;
  attemptsRemaining?: number;
  mustChangePassword?: boolean;
}> => {
  const normalizedInput = username.toLowerCase().trim();
  // Proibir autenticação direta por e-mail pelo backend: o campo de login é sempre username.
  if (normalizedInput.includes('@')) {
    return {
      user: null,
      error: 'Use seu usuário (não o e-mail) para efetuar login.'
    };
  }
  const normalizedPassword = password.trim();

  // Verificar se o usuário está bloqueado (controle local de tentativas)
  // Porém: accounts de portaria/admin/desenvolvedor não devem ser bloqueadas por este mecanismo local.
  let skipLocalBlock = false;
  try {
    const bypassRoles = ['PORTEIRO','PORTARIA','SINDICO','SÍNDICO','DESENVOLVEDOR','DEVELOPER','DEV','ADMIN','ADMINISTRADOR'];

    // Tentar resolver papel por username/email na tabela users
    try {
      const { data: userRoleRow } = await supabase
        .from('users')
        .select('role')
        .or(`username.eq.${normalizedInput},email.eq.${normalizedInput}`)
        .maybeSingle();
      if (userRoleRow?.role) {
        const r = String(userRoleRow.role).toUpperCase();
        if (bypassRoles.includes(r)) skipLocalBlock = true;
      }
    } catch {
      // ignore
    }

    // Se ainda não identificado, checar tabela staff (por exemplo portaria pode estar lá)
    if (!skipLocalBlock) {
      try {
        const { data: staffRoleRow } = await supabase
          .from('staff')
          .select('role')
          .or(`username.eq.${normalizedInput},email.eq.${normalizedInput}`)
          .maybeSingle();
        if (staffRoleRow?.role) {
          const r = String(staffRoleRow.role).toUpperCase();
          if (bypassRoles.includes(r)) skipLocalBlock = true;
        }
      } catch {
        // ignore
      }
    }
  } catch (e) {
    // qualquer erro ao resolver papel não impede autenticação — seguir com bloqueio padrão
    console.warn('[userAuth] Falha ao resolver papel para bypass de bloqueio local:', e);
  }

  if (!skipLocalBlock) {
    const blockStatus = isUserBlocked(normalizedInput);
    if (blockStatus.blocked) {
      return {
        user: null,
        error: `Conta bloqueada devido a várias tentativas falhas. Aguarde ${blockStatus.remainingMinutes} minutos antes de tentar novamente.`,
        blocked: true,
        remainingMinutes: blockStatus.remainingMinutes
      };
    }
  }

  try {
    // Resolver username -> email nas tabelas users, staff, residents (auth.users é a ÚNICA fonte de senha)
    let emailToUse = normalizedInput;
    if (!normalizedInput.includes('@')) {
      try {
        const usernameQ = normalizedInput;
        // users (síndico/porteiro)
        const { data: userRow } = await supabase
          .from('users')
          .select('email')
          .eq('username', usernameQ)
          .maybeSingle();
        if (userRow?.email) {
          emailToUse = String(userRow.email).trim().toLowerCase();
        } else {
          const { data: staffRow } = await supabase
            .from('staff')
            .select('email')
            .eq('email', usernameQ)
            .maybeSingle();
          if (staffRow?.email) emailToUse = String(staffRow.email).trim().toLowerCase();
        }
        if (!emailToUse.includes('@')) {
          const { data: residentRow } = await supabase
            .from('residents')
            .select('email')
            .or(`unit.eq.${usernameQ},email.eq.${usernameQ}`)
            .maybeSingle();
          if (residentRow?.email) emailToUse = String(residentRow.email).trim().toLowerCase();
        }
      } catch {
        // ignore
      }
    }

    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailRegex.test(emailToUse)) {
      return {
        user: null,
        error: 'Credenciais inválidas. Verifique usuário e senha. O usuário deve existir em auth.users com e-mail válido.'
      };
    }

    // Autenticação EXCLUSIVA via Supabase Auth (auth.users é a única fonte de senha)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: normalizedPassword
    });

    if (authError || !authData?.user?.id) {
    // Falha de autenticação
    // Se for usuário com bypass (porteiro/admin/dev), NÃO incrementar tentativas nem bloquear localmente.

        if (!skipLocalBlock) {
        const attempts = incrementFailedAttempts(normalizedInput);
        const remaining = MAX_LOGIN_ATTEMPTS - attempts.count;
        if (attempts.blockedUntil) {
          const remainingMinutes = Math.ceil((attempts.blockedUntil - Date.now()) / (60 * 1000));
          return {
            user: null,
            error: `Senha incorreta. Conta bloqueada por ${remainingMinutes} minutos devido a múltiplas tentativas falhas.`,
            blocked: true,
            remainingMinutes
          };
        }

        // Mapear mensagens técnicas para mensagens amigáveis
        const rawMsg = (authError?.message || '').toString();
        let friendly = authError?.message || 'Credenciais inválidas.';
        if (rawMsg.toLowerCase().includes('invalid login credentials') || rawMsg.toLowerCase().includes('invalid_credentials')) {
          friendly = 'Credenciais inválidas. Verifique e-mail/usuário e senha.';
        } else if (rawMsg.toLowerCase().includes('email not confirmed') || rawMsg.toLowerCase().includes('email_confirm')) {
          friendly = 'E-mail não confirmado. Verifique sua caixa de entrada.';
        }

        return {
          user: null,
          error: friendly,
          attemptsRemaining: remaining
        };
      } else {
        // Bypass: não registrar tentativas nem bloquear — apenas retornar erro amigável.
        const rawMsg = (authError?.message || '').toString();
        let friendly = authError?.message || 'Credenciais inválidas.';
        if (rawMsg.toLowerCase().includes('invalid login credentials') || rawMsg.toLowerCase().includes('invalid_credentials')) {
          friendly = 'Credenciais inválidas. Verifique e-mail/usuário e senha.';
        } else if (rawMsg.toLowerCase().includes('email not confirmed') || rawMsg.toLowerCase().includes('email_confirm')) {
          friendly = 'E-mail não confirmado. Verifique sua caixa de entrada.';
        }
        return { user: null, error: friendly };
      }
    }

    // Sucesso de Auth: resetar tentativas e buscar perfil por auth_user_id
    resetLoginAttempts(normalizedInput);
    const authUser = authData.user;

    // 1) tentar perfil em public.users via helper existente
    let profile = await getProfileByAuthId(authUser.id);

    // 2) se não encontrou, tentar resident
    if (!profile) {
      try {
        const { data: residentRow } = await supabase
          .from('resident')
          .select('id, auth_user_id, username, role, name, email, phone, is_active')
          .eq('auth_user_id', authUser.id)
          .maybeSingle();
        if (residentRow) {
          // Preservar o papel tal como salvo no banco (case-insensitive -> uppercase para consistência)
          const rawRole = (residentRow.role ?? '').toString();
          const roleNormalized = rawRole ? rawRole.toUpperCase() : 'MORADOR';
          profile = {
            id: authUser.id,
            username: residentRow.username ?? residentRow.email ?? '',
            role: roleNormalized,
            name: residentRow.name ?? null,
            email: residentRow.email ?? authUser.email ?? null,
            phone: residentRow.phone ?? null,
            is_active: residentRow.is_active ?? true
          };
        }
      } catch {
        // ignore errors (RLS) and continue to next
      }
    }

    // 3) se ainda não, tentar staff ou users
    if (!profile) {
      try {
        const { data: staffRow } = await supabase
          .from('staff')
          .select('id, auth_user_id, username, role, name, email, phone, is_active')
          .eq('auth_user_id', authUser.id)
          .maybeSingle();
        if (staffRow) {
          const rawRole = (staffRow.role ?? '').toString();
          const roleNormalized = rawRole ? rawRole.toUpperCase() : 'PORTEIRO';
          profile = {
            id: authUser.id,
            username: staffRow.username ?? staffRow.email ?? '',
            role: roleNormalized,
            name: staffRow.name ?? null,
            email: staffRow.email ?? authUser.email ?? null,
            phone: staffRow.phone ?? null,
            is_active: staffRow.is_active ?? true
          };
        }
      } catch {
        // ignore
      }
    }

    // 4) fallback: usar dados do auth user quando não existir perfil nas tabelas
    if (!profile) {
      // Fallback: criar um perfil mínimo com papel "MORADOR" por padrão.
      profile = {
        id: authUser.id,
        username: authUser.email ?? '',
        role: 'MORADOR',
        name: (authUser.user_metadata as any)?.full_name ?? null,
        email: authUser.email ?? null,
        phone: (authUser.user_metadata as any)?.phone ?? null,
        is_active: true
      };
    }

    // Tentar criar perfil mínimo na tabela `users` se não existir (não deve bloquear o login).
    try {
      await supabase
        .from('users')
        .insert({
          auth_user_id: authUser.id,
          username: profile.username || authUser.email || '',
          role: profile.role || 'MORADOR',
          name: profile.name ?? null,
          email: profile.email ?? null,
          phone: profile.phone ?? null,
          is_active: profile.is_active ?? true
        });
    } catch (e) {
      // Ignorar erros (ex.: duplicidade, RLS) — o login não deve falhar por causa disso.
      console.warn('[userAuth] Não foi possível criar perfil automático (não crítico):', e);
    }

    // Salvar sessão e retornar
    try { saveUserSession(profile); } catch {}
    return { user: profile, error: null };
  } catch (error: any) {
    console.error('[userAuth] Erro ao autenticar via Supabase Auth:', error);
    const msg = (error?.message ?? '').toLowerCase();
    const isNetwork = msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('err_name_not_resolved');
    const networkMessage = 'Não foi possível conectar ao Supabase (erro de rede/DNS). No navegador (F12 → Console) pode aparecer ERR_NAME_NOT_RESOLVED: este computador ou rede não consegue resolver o endereço do Supabase. Tente: outra rede (ex.: celular como hotspot), outro DNS (ex.: 8.8.8.8), desativar VPN; confira .env.local (VITE_SUPABASE_URL) e no Vercel as variáveis de ambiente.';
    try {
      if (!skipLocalBlock) incrementFailedAttempts(normalizedInput);
    } catch {
      // ignore
    }
    return {
      user: null,
      error: isNetwork ? networkMessage : (error?.message || 'Erro ao conectar com o servidor. Tente novamente.')
    };
  }
};

/**
 * Busca perfil em public.users por auth_id (id do auth.users).
 * Retorna User com id = auth_id para uso consistente no app.
 */
async function getProfileByAuthId(authId: string): Promise<User | null> {
  // Support both legacy `auth_id` and new `auth_user_id` columns
  const { data, error } = await supabase
    .from('users')
    .select('id, auth_id, auth_user_id, username, role, name, email, phone, is_active')
    .or(`auth_id.eq.${authId},auth_user_id.eq.${authId}`)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { id: string; auth_id?: string; username: string; role: string; name: string | null; email: string | null; phone: string | null; is_active: boolean };
  return {
    id: (row as any).auth_user_id || row.auth_id || row.id,
    username: row.username,
    role: row.role as string,
    name: row.name,
    email: row.email,
    phone: row.phone,
    is_active: row.is_active
  };
}

/**
 * Restaura sessão a partir do Supabase Auth (útil após reload da página).
 * Retorna { user, role } se houver sessão Auth e perfil em public.users.
 */
export async function restoreAuthSession(): Promise<{ user: User; role: string } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;
    const user = await getProfileByAuthId(session.user.id);
    if (!user) return null;
    saveUserSession(user);
    return { user, role: user.role };
  } catch {
    return null;
  }
}

/**
 * Verifica se há uma sessão ativa de usuário (sessionStorage ou Auth).
 * Síncrono: retorna apenas do sessionStorage. Use restoreAuthSession() no mount para restaurar Auth.
 */
export const checkUserSession = (): User | null => {
  try {
    const sessionData = sessionStorage.getItem('currentUser');
    if (!sessionData) return null;
    const user = JSON.parse(sessionData) as User;
    return user;
  } catch {
    return null;
  }
};

/**
 * Salva dados do usuário na sessão
 */
export const saveUserSession = (user: User): void => {
  sessionStorage.setItem('currentUser', JSON.stringify(user));
  sessionStorage.setItem('userRole', user.role);
};

/**
 * Remove dados do usuário da sessão e faz signOut no Supabase Auth
 */
export const clearUserSession = (): void => {
  supabase.auth.signOut().catch(() => {});
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('userRole');
};

/**
 * Atualiza dados do perfil do usuário (nome, email, telefone)
 */
export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; email?: string; phone?: string }
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const updatePayload = {
      name: updates.name ?? null,
      email: updates.email ?? null,
      phone: updates.phone ?? null,
      updated_at: new Date().toISOString()
    };
    // Try updating common profile tables: users, staff, residents (some deployments use different tables)
    const tableCandidates = ['users', 'staff', 'residents', 'resident'];
    let row: any = null;
    let lastError: any = null;

    for (const tbl of tableCandidates) {
      try {
        const { data, error } = await supabase
          .from(tbl)
          .update(updatePayload)
          .or(`id.eq.${userId},auth_id.eq.${userId},auth_user_id.eq.${userId}`)
          .select('id, auth_id, auth_user_id, username, role, name, email, phone, is_active')
          .maybeSingle();
        if (error) {
          lastError = error;
          continue;
        }
        if (data) {
          row = data;
          break;
        }
      } catch (e) {
        lastError = e;
        continue;
      }
    }

    if (!row) {
      console.error('Erro ao atualizar perfil do usuário (nenhuma tabela atualizada):', lastError);
      return { success: false, error: (lastError?.message || 'Erro ao atualizar perfil') };
    }

    const updatedUser: User = {
      id: row.auth_user_id || row.auth_id || row.id,
      username: row.username ?? '',
      role: (row.role as string) ?? 'MORADOR',
      name: row.name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      is_active: typeof row.is_active === 'boolean' ? row.is_active : true
    };

    // If email changed, attempt to update Supabase Auth user too.
    if (updates.email) {
      try {
        // If we have an active session for the same auth user, update will succeed client-side.
        // Otherwise, attempt update and ignore failures (will be logged).
        const { data: { session } } = await supabase.auth.getSession();
        const authIdInRow = row.auth_user_id || row.auth_id || null;
        if (session?.user?.id && authIdInRow && session.user.id === authIdInRow) {
          await supabase.auth.updateUser({ email: updates.email });
        } else {
          // Best-effort attempt (in some deployments this will fail if not the same session)
          try {
            await supabase.auth.updateUser({ email: updates.email });
          } catch (e) {
            console.warn('[userAuth] Não foi possível atualizar email em Supabase Auth (possível diferença de sessão):', e);
          }
        }
      } catch (e) {
        console.warn('[userAuth] Falha ao tentar atualizar Supabase Auth email:', e);
      }
    }

    saveUserSession(updatedUser);
    return { success: true, user: updatedUser };
  } catch (err: any) {
    console.error('Erro ao atualizar perfil do usuário:', err);
    return { success: false, error: err?.message || 'Erro ao atualizar perfil' };
  }
};

/**
 * Altera o nome de usuário (login) do síndico/porteiro.
 * Exige senha atual e garante que o novo usuário não esteja em uso.
 */
export const changeUsername = async (
  userId: string,
  currentUsername: string,
  currentPassword: string,
  newUsername: string
): Promise<{ success: boolean; error?: string; user?: User }> => {
  try {
    const normalizedNew = newUsername.trim().toLowerCase();
    if (!normalizedNew || normalizedNew.length < 3) {
      return { success: false, error: 'O novo usuário deve ter pelo menos 3 caracteres.' };
    }

    // Validar senha atual
    const loginResult = await loginUser(currentUsername, currentPassword);
    if (!loginResult.user) {
      return { success: false, error: 'Senha atual incorreta' };
    }
    if (loginResult.user.id !== userId) {
      return { success: false, error: 'Usuário não autorizado' };
    }

    const { data: existingList } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('username', normalizedNew);

    const takenByOther = (existingList || []).some(
      (r: { id: string; auth_id?: string }) => r.id !== userId && r.auth_id !== userId
    );
    if (takenByOther) {
      return { success: false, error: 'Este nome de usuário já está em uso. Escolha outro.' };
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        username: normalizedNew,
        updated_at: new Date().toISOString()
      })
      .or(`id.eq.${userId},auth_id.eq.${userId}`)
      .select('id, auth_id, username, role, name, email, phone, is_active')
      .maybeSingle();

    if (error || !data) {
      console.error('Erro ao atualizar usuário:', error);
      return { success: false, error: error?.message || 'Erro ao atualizar usuário' };
    }

    const row = data as { id: string; auth_id?: string; username: string; role: string; name: string | null; email: string | null; phone: string | null; is_active: boolean };
    const updatedUser: User = {
      id: row.auth_id || row.id,
      username: row.username,
      role: row.role as string,
      name: row.name,
      email: row.email,
      phone: row.phone,
      is_active: row.is_active
    };
    saveUserSession(updatedUser);
    resetLoginAttempts(currentUsername);
    resetLoginAttempts(normalizedNew);

    return { success: true, user: updatedUser };
  } catch (err: any) {
    console.error('Erro ao alterar usuário:', err);
    return { success: false, error: err?.message || 'Erro ao alterar usuário' };
  }
};

/**
 * Altera senha do usuário via Supabase Auth (valida senha atual via login).
 * auth.users é a única fonte de senha; nenhuma atualização em tabelas próprias.
 */
export const changeUserPassword = async (
  username: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const loginResult = await loginUser(username, currentPassword);
    if (!loginResult.user) return { success: false, error: 'Senha atual incorreta' };

    const newPwdTrim = newPassword.trim();
    if (!isStrongPassword(newPwdTrim)) {
      return { success: false, error: 'A nova senha deve ter 6 a 32 caracteres, apenas letras e números.' };
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id !== loginResult.user.id) {
      return { success: false, error: 'Sessão inválida. Faça login novamente.' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPwdTrim });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao alterar senha' };
  }
};

/**
 * Obtém ou restaura a sessão de recuperação de senha a partir da URL (hash com access_token/refresh_token ou token_hash).
 * Deve ser usado antes de updateUser() no fluxo de reset para garantir sessão ativa.
 * Funciona em navegador limpo, aba anônima e sem login prévio.
 *
 * 1. Chama initialize() e aguarda processamento do redirect (detectSessionInUrl).
 * 2. Se getSession() não retornar sessão, extrai tokens do hash.
 * 3. Suporta: access_token+refresh_token (setSession) ou token_hash (verifyOtp type=recovery).
 * 4. Retorna a sessão estabelecida.
 *
 * IMPORTANTE: Não limpe o hash da URL até após o reset bem-sucedido — permite restaurar sessão no submit.
 *
 * @returns Sessão válida ou null (link expirado, já usado ou sem tokens na URL).
 */
export async function getOrRestoreRecoverySession(): Promise<{ session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] }> {
  try {
    // Obrigatório: aguardar initialize() processar a URL (OAuth, magiclink, recovery)
    if (typeof supabase.auth.initialize === 'function') {
      await supabase.auth.initialize();
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return { session };
    }
    if (typeof window === 'undefined' || !window.location?.hash) {
      return { session: null };
    }
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    if (params.get('type') !== 'recovery') {
      return { session: null };
    }
    // Fluxo 1: access_token + refresh_token (padrão)
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        return { session: null };
      }
      const { data: { session: nextSession } } = await supabase.auth.getSession();
      return { session: nextSession ?? null };
    }
    // Fluxo 2: token_hash (PKCE)
    const tokenHash = params.get('token_hash');
    if (tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (error) {
        return { session: null };
      }
      return { session: data?.session ?? null };
    }
    return { session: null };
  } catch {
    return { session: null };
  }
}

/**
 * Remove tokens de recuperação da URL por segurança (evitar exposição no histórico/back).
 * Chamar após estabelecer sessão com sucesso.
 */
export function clearRecoveryHashFromUrl(): void {
  try {
    if (typeof window !== 'undefined' && window.history?.replaceState && window.location?.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      if (params.get('type') === 'recovery') {
        window.history.replaceState({}, '', window.location.pathname + window.location.search || '/');
      }
    }
  } catch {
    // ignore
  }
}

/** Obtém URL base para redirect de recuperação (env ou origin) */
function getResetRedirectUrl(): string {
  const env = (import.meta as { env?: Record<string, string> }).env;
  const base = (env?.VITE_APP_URL || env?.VITE_SUPABASE_REDIRECT || '').toString().trim();
  if (base) return base.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Solicita recuperação de senha via Supabase Auth (EXCLUSIVAMENTE).
 * O e-mail deve existir em auth.users. redirectTo usa VITE_APP_URL ou origin.
 */
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const base = getResetRedirectUrl();
    const redirectTo = base;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo
    });
    if (error) {
      const raw = (error.message || '').toString().toLowerCase();
      if (raw.includes('redirect') || raw.includes('redirect url') || raw.includes('url configuration')) {
        return {
          success: false,
          error: `Falha ao enviar o e-mail. No Supabase: Authentication → URL Configuration → Redirect URLs, adicione: ${base} e ${redirectTo}. Verifique também Authentication → E-mails → Configurações SMTP.`
        };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao solicitar recuperação.' };
  }
};

/**
 * Resolve username, unidade ou e-mail para e-mail (users, staff, residents).
 * Usado para recuperação: o e-mail deve existir em auth.users.
 */
export const getEmailForReset = async (usernameOrEmailOrUnit: string): Promise<string | null> => {
  try {
    const q = usernameOrEmailOrUnit.trim().toLowerCase();
    if (!q) return null;

    const [userRes, staffRes, residentRes] = await Promise.all([
      supabase.from('users').select('email').or(`username.eq.${q},email.eq.${q}`).eq('is_active', true).maybeSingle(),
      supabase.from('staff').select('email').eq('email', q).maybeSingle(),
      supabase.from('residents').select('email').or(`unit.eq.${q},email.eq.${q}`).maybeSingle()
    ]);

    return userRes.data?.email ?? staffRes.data?.email ?? residentRes.data?.email ?? null;
  } catch {
    return null;
  }
};


