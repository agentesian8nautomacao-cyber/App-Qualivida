import { supabase } from './supabase';
import { Resident } from '../types';
import { normalizeUnit, compareUnits } from '../utils/unitFormatter';

// Função simples para hash de senha (usando bcrypt via Supabase Edge Function seria ideal)
// Por enquanto, vamos usar uma função baseada em crypto quando disponível,
// com fallback para ambientes inseguros (ex: http em rede local no celular).
const hashPassword = async (password: string): Promise<string> => {
  const trimmed = password.trim();
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      const encoder = new TextEncoder();
      const data = encoder.encode(trimmed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }
  } catch (err) {
    console.warn('Falha ao usar crypto.subtle para hash de senha (morador), usando fallback:', err);
  }

  return trimmed;
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

/** Mesmo hash usado no login do morador; use na sync após recuperação de senha (frontend → RPC). */
export async function computeResidentPasswordHash(password: string): Promise<string> {
  return hashPassword(password);
}

// Registrar novo morador
export const registerResident = async (
  resident: Omit<Resident, 'id'>,
  password: string
): Promise<{ resident: Resident; success: boolean; error?: string }> => {
  try {
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

    // Hash da senha
    const passwordHash = await hashPassword(password);

    // Inserir morador com unidade normalizada
    // Usar RPC ou query direta para evitar problemas de cache do schema
    const { data, error } = await supabase
      .from('residents')
      .insert({
        name: resident.name.trim(),
        unit: normalizedUnit,
        email: resident.email || null,
        phone: resident.phone || null,
        whatsapp: resident.whatsapp || null,
        // Persistir dados extras, incluindo veículo, em extra_data (JSONB)
        extra_data: {
          ...(resident.extraData || {}),
          vehiclePlate: resident.vehiclePlate || undefined,
          vehicleModel: resident.vehicleModel || undefined,
          vehicleColor: resident.vehicleColor || undefined
        },
        password_hash: passwordHash
      } as any) // Usar 'as any' temporariamente para contornar cache do schema
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

// Login de morador
export const loginResident = async (
  unit: string,
  password: string
): Promise<{ resident: Resident | null; success: boolean; error?: string }> => {
  try {
    // Normalizar unidade antes de buscar
    const normalizedUnit = normalizeUnit(unit);
    
    // Buscar todas as unidades e comparar
    const { data: allResidents, error: fetchError } = await supabase
      .from('residents')
      .select('*');
    
    if (fetchError || !allResidents) {
      return {
        resident: null,
        success: false,
        error: 'Erro ao buscar morador'
      };
    }
    
    // Encontrar morador pela unidade normalizada
    const data = allResidents.find(r => compareUnits(r.unit, normalizedUnit));

    if (!data) {
      return {
        resident: null,
        success: false,
        error: 'Unidade ou senha incorretos'
      };
    }

    // Verificar senha
    if (!data.password_hash) {
      return {
        resident: null,
        success: false,
        error: 'Morador não possui senha cadastrada. Faça o cadastro primeiro.'
      };
    }

    const isValid = await verifyPassword(password, data.password_hash);
    
    if (!isValid) {
      return {
        resident: null,
        success: false,
        error: 'Unidade ou senha incorretos'
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
    console.error('Erro ao fazer login:', err);
    return {
      resident: null,
      success: false,
      error: err.message || 'Erro ao fazer login'
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

// Atualizar senha do morador
export const updateResidentPassword = async (
  residentId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const passwordHash = await hashPassword(newPassword);

    const { error } = await supabase
      .from('residents')
      .update({ password_hash: passwordHash } as any) // Usar 'as any' para contornar cache do schema
      .eq('id', residentId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Erro ao atualizar senha'
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao atualizar senha'
    };
  }
};