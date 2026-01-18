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

/**
 * Faz hash da senha usando SHA-256 (Web Crypto API)
 */
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Valida credenciais de usuário (PORTEIRO/SINDICO) no Supabase
 * @param username Nome de usuário
 * @param password Senha em texto plano
 * @returns Dados do usuário se credenciais válidas, null caso contrário
 */
export const loginUser = async (username: string, password: string): Promise<User | null> => {
  try {
    // Hash da senha fornecida
    const hashedPassword = await hashPassword(password);

    // Buscar usuário no banco
    const { data, error } = await supabase
      .from('users')
      .select('id, username, role, name, email, phone, is_active, password_hash')
      .eq('username', username.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.error('Erro ao buscar usuário:', error);
      return null;
    }

    // Comparar hash da senha
    // Se o password_hash for placeholder, aceitar senhas padrão conhecidas
    if (data.password_hash === '$2a$10$placeholder_hash_here') {
      // Senhas padrão hardcoded para desenvolvimento
      const defaultPasswords: Record<string, string> = {
        'portaria': '123456',
        'admin': 'admin123',
        'desenvolvedor': 'dev'
      };
      
      if (defaultPasswords[username.toLowerCase().trim()] !== password) {
        return null;
      }
      // Se passar, retornar dados do usuário
    } else if (data.password_hash !== hashedPassword) {
      // Se o hash não corresponder, credenciais inválidas
      return null;
    }

    // Retornar dados do usuário (sem o password_hash)
    const { password_hash: _, ...userData } = data;
    return userData as User;
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return null;
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
