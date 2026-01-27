import { supabase } from './supabase';

// Interface para dados do usuário
export interface User {
  id: string;
  username: string;
  role: 'PORTEIRO' | 'SINDICO';
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
 * Faz hash da senha usando SHA-256 (Web Crypto API) quando disponível.
 * Em contexto não seguro (ex: http em rede local no celular), crypto.subtle
 * não está disponível, então usamos um fallback simples para não quebrar o login.
 *
 * IMPORTANTE: em produção (https://app-qualivida.vercel.app) a versão com
 * SHA-256 será usada normalmente.
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

  // Fallback para ambiente não seguro (ex: http://192.168.x.x no celular)
  // Aqui apenas retornamos a senha em texto puro, o que funciona para:
  // - contas com password_hash no formato "plain:senha"
  // - ambiente de desenvolvimento com senhas simples
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
}> => {
  const normalizedUsername = username.toLowerCase().trim();

  // Verificar se o usuário está bloqueado
  const blockStatus = isUserBlocked(normalizedUsername);
  if (blockStatus.blocked) {
    return {
      user: null,
      error: `Conta bloqueada devido a várias tentativas falhas. Aguarde ${blockStatus.remainingMinutes} minutos antes de tentar novamente.`,
      blocked: true,
      remainingMinutes: blockStatus.remainingMinutes
    };
  }

  try {
    // Hash da senha fornecida
    const hashedPassword = await hashPassword(password);

    // Buscar usuário no banco
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, name, email, phone, is_active, password_hash')
      .eq('username', normalizedUsername)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      // Incrementar tentativas falhas apenas se o usuário existir
      incrementFailedAttempts(normalizedUsername);
      return {
        user: null,
        error: 'Usuário ou senha inválidos',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - getLoginAttempts(normalizedUsername).count
      };
    }

    // Verificar senha
    let isValidPassword = false;
    
    // Se o password_hash começar com "plain:", comparar diretamente (senha em texto plano)
    if (data.password_hash && data.password_hash.startsWith('plain:')) {
      const plainPassword = data.password_hash.substring(6); // Remove "plain:"
      isValidPassword = plainPassword === password;
    }
    // Se o password_hash for placeholder, aceitar senhas padrão conhecidas
    else if (data.password_hash === '$2a$10$placeholder_hash_here') {
      const defaultPasswords: Record<string, string> = {
        'portaria': '123456',
        'admin': 'admin123',
        'desenvolvedor': 'dev'
      };
      isValidPassword = defaultPasswords[normalizedUsername] === password;
    } 
    // Caso contrário, comparar com hash SHA-256
    else {
      isValidPassword = data.password_hash === hashedPassword;
    }

    if (!isValidPassword) {
      // Senha incorreta, incrementar tentativas
      const attempts = incrementFailedAttempts(normalizedUsername);
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

      return {
        user: null,
        error: `Senha incorreta. ${remaining > 0 ? `${remaining} tentativa(s) restante(s).` : 'Conta será bloqueada.'}`,
        attemptsRemaining: remaining
      };
    }

    // Login bem-sucedido, resetar tentativas
    resetLoginAttempts(normalizedUsername);

    // Retornar dados do usuário (sem o password_hash)
    const { password_hash: _, ...userData } = data;
    return {
      user: userData as User,
      error: null
    };
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return {
      user: null,
      error: 'Erro ao conectar com o servidor. Tente novamente.'
    };
  }
};

/**
 * Verifica se há uma sessão ativa de usuário
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
 * Remove dados do usuário da sessão
 */
export const clearUserSession = (): void => {
  sessionStorage.removeItem('currentUser');
  sessionStorage.removeItem('userRole');
};

/**
 * Gera token de recuperação de senha
 */
export const generatePasswordResetToken = async (usernameOrEmail: string): Promise<{
  success: boolean;
  message: string;
  email?: string;
}> => {
  try {
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

    // Gerar token único
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Token válido por 24 horas

    // Inserir token no banco
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token,
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

    // Em produção, você enviaria um email aqui
    // Por enquanto, retornamos o token (apenas para desenvolvimento)
    console.log('🔐 TOKEN DE RECUPERAÇÃO (DEV ONLY):', token);
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
    const { data, error } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (error || !data) {
      return {
        valid: false,
        message: 'Token inválido ou não encontrado.'
      };
    }

    if (data.used) {
      return {
        valid: false,
        message: 'Este token já foi utilizado.'
      };
    }

    if (new Date(data.expires_at) < new Date()) {
      return {
        valid: false,
        message: 'Este token expirou. Solicite uma nova recuperação de senha.'
      };
    }

    return {
      valid: true,
      userId: data.user_id
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
    // Validar token
    const tokenValidation = await validateResetToken(token);
    if (!tokenValidation.valid || !tokenValidation.userId) {
      return {
        success: false,
        message: tokenValidation.message || 'Token inválido.'
      };
    }

    // Hash da nova senha
    const newPasswordHash = await hashPassword(newPassword);

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

    // Marcar token como usado
    await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token);

    // Limpar tentativas de login para este usuário
    const { data: user } = await supabase
      .from('users')
      .select('username')
      .eq('id', tokenValidation.userId)
      .single();

    if (user) {
      resetLoginAttempts(user.username);
    }

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
