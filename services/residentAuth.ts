import { supabase } from './supabase';
import { Resident } from '../types';
import { normalizeUnit, compareUnits } from '../utils/unitFormatter';

/**
 * Login de morador usa EXCLUSIVAMENTE Supabase Auth (auth.users).
 * Unidade → e-mail (residents) → signInWithPassword.
 * Nenhuma senha é armazenada em tabelas próprias.
 */

// Registrar novo morador
export const registerResident = async (
  resident: Omit<Resident, 'id'>,
  password: string
): Promise<{ resident: Resident; success: boolean; error?: string }> => {
  try {
    // Validar e normalizar e-mail (obrigatório para integração com Supabase Auth)
    const emailRaw = (resident.email || '').toString().trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRaw || !emailRegex.test(emailRaw)) {
      return {
        resident: resident as Resident,
        success: false,
        error: 'Informe um e-mail válido. O e-mail é obrigatório para cadastro e recuperação de senha.'
      };
    }

    // Normalizar unidade antes de verificar e salvar
    const normalizedUnit = normalizeUnit(resident.unit);
    
    // Buscar todas as unidades para comparar (já que pode haver variações de formato)
    const { data: allResidents, error: checkError } = await supabase
      .from('residents')
      .select('id, unit');
    
    // Verificar se a unidade normalizada já existe
    const existing = allResidents?.find(r => compareUnits(r.unit, normalizedUnit));
    
    if (existing) {
      return {
        resident: existing as Resident,
        success: false,
        error: `Já existe um cadastro para a unidade ${normalizedUnit}`
      };
    }

    // Criar usuário primeiro em auth.users (Supabase Auth)
    // Isso garante que login e recuperação de senha usem sempre o Auth.
    let authUserId: string | null = null;
    try {
      const pwdTrim = password.trim();
      const baseUrl = (import.meta.env.VITE_APP_URL || '').toString().trim().replace(/\/$/, '')
        || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailRaw,
        password: pwdTrim,
        options: {
          emailRedirectTo: `${baseUrl}/reset-password`
        }
      });

      if (signUpError) {
        console.error('[registerResident] Erro ao criar usuário em auth.users:', signUpError);
        const rawMsg = (signUpError.message || '').toString().toLowerCase();
        let friendly = signUpError.message || 'Erro ao criar usuário de autenticação.';
        if (rawMsg.includes('user already registered') || rawMsg.includes('already exists')) {
          friendly = 'Este e-mail já está cadastrado. Use "Esqueci minha senha" para redefinir a senha.';
        }
        return {
          resident: resident as Resident,
          success: false,
          error: friendly
        };
      }

      authUserId = (signUpData?.user?.id ?? (signUpData as any)?.id) || null;
      if (!authUserId) {
        return {
          resident: resident as Resident,
          success: false,
          error: 'Não foi possível criar o usuário de autenticação. Tente novamente.'
        };
      }
    } catch (authErr: any) {
      console.error('[registerResident] Exceção ao criar usuário em auth.users:', authErr);
      return {
        resident: resident as Resident,
        success: false,
        error: authErr?.message || 'Erro ao criar usuário de autenticação.'
      };
    }

    // Inserir morador com unidade normalizada (sem password_hash; auth.users é a única fonte de senha)
    const { data, error } = await supabase
      .from('residents')
      .insert({
        name: resident.name.trim(),
        unit: normalizedUnit,
        email: emailRaw,
        phone: resident.phone || null,
        whatsapp: resident.whatsapp || null,
        extra_data: {
          ...(resident.extraData || {}),
          vehiclePlate: resident.vehiclePlate || undefined,
          vehicleModel: resident.vehicleModel || undefined,
          vehicleColor: resident.vehicleColor || undefined
        },
        auth_user_id: authUserId
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Erro ao cadastrar morador:', error);
      // Tratar erro do Supabase de forma mais detalhada
      let errorMessage = 'Erro ao cadastrar morador';
      
      // Verificar se é erro de coluna não encontrada ou cache do schema
      if (error.message && (
        error.message.includes('password_hash') || 
        error.message.includes('column') ||
        error.message.includes('schema cache') ||
        error.message.toLowerCase().includes('could not find')
      )) {
        // Se a coluna existe mas o cache está desatualizado, sugerir refresh
        errorMessage = '⚠️ Erro de cache do schema: A coluna password_hash existe no banco, mas o cache do Supabase está desatualizado. Soluções: 1) Aguarde 2-3 minutos e tente novamente, 2) Limpe o cache do navegador (Ctrl+Shift+R), 3) Recarregue a página. O código foi ajustado para contornar este problema.';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.code) {
        // Erro do Supabase com código
        errorMessage = `Erro ${error.code}: ${error.message || error.hint || 'Erro ao cadastrar morador'}`;
      }
      
      return {
        resident: resident as Resident,
        success: false,
        error: errorMessage
      };
    }

    return {
      resident: {
        id: data.id,
        name: data.name,
        unit: data.unit,
        email: data.email || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        vehiclePlate: data.extra_data?.vehiclePlate || data.extra_data?.vehicle_plate || '',
        vehicleModel: data.extra_data?.vehicleModel || data.extra_data?.vehicle_model || '',
        vehicleColor: data.extra_data?.vehicleColor || data.extra_data?.vehicle_color || '',
        extraData: data.extra_data
      },
      success: true
    };
  } catch (err: any) {
    console.error('Erro ao registrar morador:', err);
    // Tratar erro de forma mais detalhada
    let errorMessage = 'Erro ao cadastrar morador';
    if (err) {
      if (err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err.error?.message) {
        errorMessage = err.error.message;
      }
    }
    return {
      resident: resident as Resident,
      success: false,
      error: errorMessage
    };
  }
};

// Login de morador via Supabase Auth (unidade → email → signInWithPassword)
export const loginResident = async (
  unit: string,
  password: string
): Promise<{ resident: Resident | null; success: boolean; error?: string }> => {
  try {
    const normalizedUnit = normalizeUnit(unit);

    const { data: allResidents, error: fetchError } = await supabase
      .from('residents')
      .select('id, name, unit, email, phone, whatsapp, extra_data, auth_user_id');

    if (fetchError || !allResidents) {
      if (fetchError) {
        const code = (fetchError as { code?: string }).code;
        const msg = String(fetchError.message || '').toLowerCase();
        const isRls = code === 'PGRST301' || msg.includes('row-level security');
        const isConnection = msg.includes('fetch') || msg.includes('failed to fetch');
        if (isRls) {
          return {
            resident: null,
            success: false,
            error: 'Acesso à tabela residents bloqueado (RLS). Configure políticas no Supabase.'
          };
        }
        if (isConnection) {
          return {
            resident: null,
            success: false,
            error: import.meta.env?.DEV
              ? 'Sem conexão com o Supabase. Verifique .env.local.'
              : 'Sem conexão com o servidor.'
          };
        }
      }
      return { resident: null, success: false, error: 'Erro ao buscar morador' };
    }

    const data = allResidents.find((r: any) => compareUnits(r.unit, normalizedUnit));
    if (!data || !(data as any).email) {
      return {
        resident: null,
        success: false,
        error: 'Unidade ou senha incorretos'
      };
    }

    const email = String((data as any).email).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return {
        resident: null,
        success: false,
        error: 'Morador sem e-mail cadastrado. Cadastre um e-mail para usar recuperação de senha.'
      };
    }

    // Morador sem auth_user_id: cadastrado sem senha (ex.: import sem API). Precisa cadastro completo.
    if (!(data as any).auth_user_id) {
      return {
        resident: null,
        success: false,
        error: 'Morador não possui senha cadastrada. O síndico/porteiro deve recadastrar com senha, ou use "Criar conta" na tela de login.'
      };
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password.trim()
    });

    if (authError || !authData?.user?.id) {
      return {
        resident: null,
        success: false,
        error: 'Unidade ou senha incorretos'
      };
    }

    return {
      resident: {
        id: (data as any).id,
        name: (data as any).name,
        unit: (data as any).unit,
        email: (data as any).email || '',
        phone: (data as any).phone || '',
        whatsapp: (data as any).whatsapp || '',
        vehiclePlate: (data as any).extra_data?.vehiclePlate || (data as any).extra_data?.vehicle_plate || '',
        vehicleModel: (data as any).extra_data?.vehicleModel || (data as any).extra_data?.vehicle_model || '',
        vehicleColor: (data as any).extra_data?.vehicleColor || (data as any).extra_data?.vehicle_color || '',
        extraData: (data as any).extra_data
      },
      success: true
    };
  } catch (err: any) {
    console.error('[residentAuth] Erro ao fazer login:', err);
    const msg = (err?.message || '').toLowerCase();
    const isNetwork = msg.includes('fetch') || msg.includes('failed to fetch');
    return {
      resident: null,
      success: false,
      error: isNetwork
        ? 'Sem conexão com o Supabase.'
        : (err?.message || 'Erro ao fazer login')
    };
  }
};

// Buscar morador por unidade (sem autenticação)
export const getResidentByUnit = async (unit: string): Promise<Resident | null> => {
  try {
    // Normalizar unidade antes de buscar
    const normalizedUnit = normalizeUnit(unit);
    
    // Buscar todas as unidades e comparar
    const { data: allResidents, error: fetchError } = await supabase
      .from('residents')
      .select('*');
    
    if (fetchError || !allResidents) {
      return null;
    }
    
    // Encontrar morador pela unidade normalizada
    const data = allResidents.find(r => compareUnits(r.unit, normalizedUnit));

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      unit: data.unit,
      email: data.email || '',
      phone: data.phone || '',
      whatsapp: data.whatsapp || '',
      vehiclePlate: data.extra_data?.vehiclePlate || data.extra_data?.vehicle_plate || '',
      vehicleModel: data.extra_data?.vehicleModel || data.extra_data?.vehicle_model || '',
      vehicleColor: data.extra_data?.vehicleColor || data.extra_data?.vehicle_color || '',
      extraData: data.extra_data
    };
  } catch (err) {
    console.error('Erro ao buscar morador:', err);
    return null;
  }
};

/**
 * Obtém o e-mail do morador a partir de unidade ou e-mail (para recuperação de senha).
 * Usado no "Esqueci a senha" quando o usuário está na aba Morador.
 */
export const getEmailForResetResident = async (unitOrEmail: string): Promise<string | null> => {
  const value = unitOrEmail.trim();
  const q = value.toLowerCase();
  const isEmail = q.includes('@');
  try {
    if (isEmail) {
      const { data } = await supabase
        .from('residents')
        .select('email')
        .eq('email', q)
        .maybeSingle();
      return data?.email ?? null;
    }
    const normalizedUnit = normalizeUnit(value);
    if (!normalizedUnit) return null;
    const { data } = await supabase
      .from('residents')
      .select('email')
      .eq('unit', normalizedUnit)
      .maybeSingle();
    if (data?.email) return data.email;
    const { data: byRaw } = await supabase
      .from('residents')
      .select('email')
      .eq('unit', value)
      .maybeSingle();
    return byRaw?.email ?? null;
  } catch (err) {
    console.warn('getEmailForResetResident:', err);
    return null;
  }
};

// Atualizar senha do morador via Supabase Auth (requer sessão ativa)
export const updateResidentPassword = async (
  _residentId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { success: false, error: 'Sessão não encontrada. Faça login novamente.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao atualizar senha' };
  }
};