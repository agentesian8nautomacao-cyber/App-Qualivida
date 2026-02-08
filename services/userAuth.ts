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
  if (!password || password.length < 6 || password.length > 32) return false;
  if (!/^[A-Za-z0-9]+$/.test(password)) return false;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return false;
  return true;
};

/**
 * Faz hash da senha usando SHA-256 (Web Crypto API) quando disponível.
 * A senha é tratada como digitada (maiúsculas e minúsculas diferenciadas).
 * Em contexto não seguro (ex: http em rede local no celular), crypto.subtle
 * não está disponível, então usamos um fallback simples para não quebrar o login.
 */
const hashPassword = async (password: string): Promise<string> => {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }
  } catch (err) {
    console.warn('Falha ao usar crypto.subtle para hash de senha, usando fallback:', err);
  }

  // Fallback para ambiente não seguro: retorna a senha em texto puro (case-sensitive).
  return password;
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
  const normalizedEmail = username.toLowerCase().trim();
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
        .or(`username.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
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
          .or(`username.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
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
    const blockStatus = isUserBlocked(normalizedEmail);
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
    // If input is not an email (username), try to resolve it to an email in users/residents/staff
    let emailToUse = normalizedEmail;
    if (!normalizedEmail.includes('@')) {
      try {
        const usernameQ = normalizedEmail;
        // Try users table
        const { data: userRow } = await supabase
          .from('users')
          .select('email')
          .eq('username', usernameQ)
          .maybeSingle();
        if (userRow?.email) {
          emailToUse = String(userRow.email).trim().toLowerCase();
        } else {
          // try residents table (some apps use unit/name login)
          try {
            const { data: residentRow } = await supabase
              .from('residents')
              .select('email')
              .eq('username', usernameQ)
              .maybeSingle();
            if (residentRow?.email) emailToUse = String(residentRow.email).trim().toLowerCase();
          } catch {
            // ignore resident lookup errors
          }

          // try staff table (porteiro/admin/dev podem estar aqui)
          if (!emailToUse.includes('@')) {
            try {
              const { data: staffRow } = await supabase
                .from('staff')
                .select('email')
                .eq('username', usernameQ)
                .maybeSingle();
              if (staffRow?.email) emailToUse = String(staffRow.email).trim().toLowerCase();
            } catch {
              // ignore staff lookup errors
            }
          }
        }
      } catch {
        // ignore lookup errors and continue using the raw input as email (validated below)
      }
    }

    // Normalize and validate email before sending to Supabase Auth.
    const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!simpleEmailRegex.test(emailToUse)) {
      // Do not call Supabase Auth with an invalid email format (this causes 400).
      return {
        user: null,
        error: 'Informe o e-mail cadastrado para efetuar login. Se você usa um usuário (ex.: porteiro), verifique se há um e-mail cadastrado no perfil.'
      };
    }

    // Debug logs removed in production.

    // Autenticar via Supabase Auth usando email resolvido
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: normalizedPassword
    });

    if (authError || !authData?.user?.id) {
    // Falha de autenticação
    // Se for usuário com bypass (porteiro/admin/dev), NÃO incrementar tentativas nem bloquear localmente.

      if (!skipLocalBlock) {
        const attempts = incrementFailedAttempts(normalizedEmail);
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
    resetLoginAttempts(normalizedEmail);
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
      if (!skipLocalBlock) incrementFailedAttempts(normalizedEmail);
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
    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .or(`id.eq.${userId},auth_id.eq.${userId}`)
      .select('id, auth_id, username, role, name, email, phone, is_active')
      .maybeSingle();

    if (error || !data) {
      console.error('Erro ao atualizar perfil do usuário:', error);
      return { success: false, error: error?.message || 'Erro ao atualizar perfil' };
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
    if (updates.email && typeof supabase.auth.updateUser === 'function') {
      supabase.auth.updateUser({ email: updates.email }).catch(() => {});
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
 * Altera senha do usuário (validando senha atual).
 * @param storePlain - se true, salva como "plain:senha" (para porteiros; o síndico pode ver no modal de edição)
 */
export const changeUserPassword = async (
  username: string,
  currentPassword: string,
  newPassword: string,
  options?: { storePlain?: boolean }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const loginResult = await loginUser(username, currentPassword);
    if (!loginResult.user) {
      return { success: false, error: 'Senha atual incorreta' };
    }

    const newPwdTrim = newPassword.trim();

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id === loginResult.user.id) {
      const { error } = await supabase.auth.updateUser({ password: newPwdTrim });
      if (!error) return { success: true };
      console.warn('Auth updateUser falhou, tentando legado:', error);
    }

    const newPasswordHash = options?.storePlain
      ? `plain:${newPwdTrim}`
      : await hashPassword(newPwdTrim);

    const { error } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .or(`id.eq.${loginResult.user.id},auth_id.eq.${loginResult.user.id}`);

    if (error) {
      console.error('Erro ao atualizar senha:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao alterar senha:', err);
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

/**
 * Solicita recuperação de senha via Supabase Auth.
 * O Supabase envia o e-mail com o link (configuração em Dashboard → Authentication → Email).
 * redirectTo deve ser a URL da sua app para onde o usuário será redirecionado (ex: /reset-password).
 */
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const redirectTo = 'https://qualivida-club-residence.vercel.app/reset-password';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao solicitar recuperação.' };
  }
};

/**
 * Obtém o e-mail do usuário a partir de username ou e-mail (para recuperação).
 */
export const getEmailForReset = async (usernameOrEmail: string): Promise<string | null> => {
  const q = usernameOrEmail.trim().toLowerCase();
  const { data } = await supabase
    .from('users')
    .select('email')
    .or(`username.eq.${q},email.eq.${q}`)
    .eq('is_active', true)
    .maybeSingle();
  return data?.email ?? null;
};

/**
 * Gera token de recuperação de senha (legado; use requestPasswordReset quando o usuário tiver auth_id)
 */
export const generatePasswordResetToken = async (usernameOrEmail: string): Promise<{
  success: boolean;
  message: string;
  email?: string;
}> => {
  try {
    // Ambiente precisa suportar Web Crypto seguro para não armazenar token em texto puro
    if (typeof crypto === 'undefined' || !crypto.subtle || !(location.protocol === 'https:' || location.hostname === 'localhost')) {
      return {
        success: false,
        message: 'Recuperação de senha indisponível neste ambiente. Use o link enviado por e-mail em um navegador seguro.'
      };
    }

    // Buscar usuário por username ou email
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, name')
      .or(`username.eq.${usernameOrEmail.toLowerCase()},email.eq.${usernameOrEmail.toLowerCase()}`)
      .eq('is_active', true)
      .single();

    if (error || !user || !user.email) {
      // Não revelar se o usuário existe ou não por segurança
      return {
        success: true,
        message: 'Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação.'
      };
    }

    // Rate limit básico por usuário (fallback local): máximo 1 solicitação a cada 2 minutos
    const { data: lastToken } = await supabase
      .from('password_reset_tokens')
      .select('id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastToken) {
      const lastCreatedAt = new Date((lastToken as any).created_at).getTime();
      const now = Date.now();
      const twoMinutesMs = 2 * 60 * 1000;
      if (now - lastCreatedAt < twoMinutesMs) {
        console.info('[AUTH-EVENT] Password reset request (fallback) rate-limited', {
          userId: user.id,
          username: user.username,
          email: user.email,
          at: new Date().toISOString()
        });
        return {
          success: true,
          message: 'Se o usuário existir e tiver email cadastrado, você receberá instruções de recuperação. Se já solicitou recentemente, aguarde alguns minutos.'
        };
      }
    }

    // Invalidar tokens anteriores ainda não utilizados
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);

    // Gerar token único (valor bruto só é exibido no console em DEV)
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(rawBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Gerar hash SHA-256 do token para salvar no banco
    const encoder = new TextEncoder();
    const dataToHash = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Expiração curta (15 minutos)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Inserir token (hash) no banco
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: tokenHash,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (tokenError) {
      console.error('Erro ao criar token de recuperação:', tokenError);
      return {
        success: false,
        message: 'Erro ao gerar token de recuperação. Tente novamente.'
      };
    }

    console.info('[AUTH-EVENT] Password reset requested (fallback)', {
      userId: user.id,
      username: user.username,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
      at: new Date().toISOString()
    });

    // Em desenvolvimento, exibimos o token bruto no console para permitir teste manual
    console.log('🔐 TOKEN DE RECUPERAÇÃO (DEV ONLY - NÃO ARMAZENADO EM TEXTO PURO NO BANCO):', token);
    console.log('📧 Email do usuário:', user.email);

    return {
      success: true,
      message: `Token de recuperação gerado. Verifique o console para ver o token (desenvolvimento apenas).`,
      email: user.email
    };
  } catch (error) {
    console.error('Erro ao gerar token de recuperação:', error);
    return {
      success: false,
      message: 'Erro ao processar solicitação. Tente novamente.'
    };
  }
};

/**
 * Valida token de recuperação de senha
 */
export const validateResetToken = async (token: string): Promise<{
  valid: boolean;
  userId?: string;
  message?: string;
}> => {
  try {
    // Gerar hash do token informado pelo usuário
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      console.error('Web Crypto API indisponível para validar token de recuperação.');
      return {
        valid: false,
        message: 'Não foi possível validar o link de recuperação. Use um navegador seguro (HTTPS) e tente novamente.'
      };
    }

    const encoder = new TextEncoder();
    const tokenBytes = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: tokenRow, error } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', tokenHash)
      .single();

    if (error || !tokenRow) {
      return {
        valid: false,
        message: 'Token inválido ou não encontrado.'
      };
    }

    if (tokenRow.used) {
      return {
        valid: false,
        message: 'Este token já foi utilizado.'
      };
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return {
        valid: false,
        message: 'Este token expirou. Solicite uma nova recuperação de senha.'
      };
    }

    return {
      valid: true,
      userId: tokenRow.user_id
    };
  } catch (error) {
    console.error('Erro ao validar token:', error);
    return {
      valid: false,
      message: 'Erro ao validar token.'
    };
  }
};

/**
 * Redefine senha usando token
 */
export const resetPasswordWithToken = async (
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const pwdTrim = newPassword.trim();
    if (!isStrongPassword(pwdTrim)) {
      return {
        success: false,
        message: 'A nova senha deve ter 6 caracteres, apenas letras e números. O sistema diferencia maiúsculas de minúsculas.'
      };
    }

    // Validar token
    const tokenValidation = await validateResetToken(token);
    if (!tokenValidation.valid || !tokenValidation.userId) {
      return {
        success: false,
        message: tokenValidation.message || 'Token inválido.'
      };
    }

    // Hash da nova senha (case-sensitive)
    const newPasswordHash = await hashPassword(pwdTrim);

    // Atualizar senha do usuário
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash, updated_at: new Date().toISOString() })
      .eq('id', tokenValidation.userId);

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return {
        success: false,
        message: 'Erro ao atualizar senha. Tente novamente.'
      };
    }

    // Marcar token como usado (no banco está o hash do token)
    const encoder = new TextEncoder();
    const tokenBytes = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', tokenHash);

    // Limpar tentativas de login para este usuário
    const { data: user } = await supabase
      .from('users')
      .select('username')
      .eq('id', tokenValidation.userId)
      .single();

    if (user) {
      resetLoginAttempts(user.username);
    }

    console.info('[AUTH-EVENT] Password reset completed', {
      userId: tokenValidation.userId,
      username: user?.username,
      at: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Senha redefinida com sucesso! Você já pode fazer login.'
    };
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    return {
      success: false,
      message: 'Erro ao redefinir senha. Tente novamente.'
    };
  }
};

