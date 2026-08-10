import { createClient } from '@supabase/supabase-js';

// Obter variáveis de ambiente
const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Garantir URL absoluta https:// (evita "requested path is invalid" em localhost)
let supabaseUrl = '';
if (rawSupabaseUrl) {
  let host = rawSupabaseUrl.replace(/^https?:\/\//, '').replace(/^\/+/, '').split('/')[0].trim();
  if (host && host.includes('.supabase.co')) {
    supabaseUrl = `https://${host}`;
  }
}
// Garantia final: nunca passar URL sem protocolo (evita requisição relativa → localhost)
if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = supabaseUrl.startsWith('http://') ? supabaseUrl : `https://${supabaseUrl}`;
}

const isPlaceholder = !supabaseUrl || !supabaseAnonKey?.trim();
const isAbsolute = supabaseUrl.startsWith('https://');
if (import.meta.env.DEV) {
  if (isPlaceholder) {
    console.warn(`[Supabase] URL: ${rawSupabaseUrl ? 'definida' : 'NÃO DEFINIDA'}. Key: ${supabaseAnonKey ? 'ok' : 'NÃO DEFINIDA'}. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local`);
  } else {
    console.log(`[Supabase] Usando: ${supabaseUrl}`);
  }
}

// Criar cliente Supabase (mesmo que as variáveis estejam vazias, para evitar erros)
export const isSupabasePlaceholder = isPlaceholder;
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'x-client-info': 'gestao-qualivida-residence'
      }
    }
  }
);

// Interceptador global removido temporariamente para debug
// Se o erro 409 parar de aparecer no console, significa que era apenas log do interceptor
// TODO: Reimplementar interceptor sem causar logs desnecessários

// Tipos para as tabelas do Supabase
export type Database = {
  public: {
    Tables: {
      residents: {
        Row: {
          id: string;
          name: string;
          unit: string;
          email: string | null;
          phone: string | null;
          whatsapp: string | null;
          password_hash: string | null;
          extra_data: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          unit: string;
          email?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          password_hash?: string | null;
          extra_data?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          unit?: string;
          email?: string | null;
          phone?: string | null;
          whatsapp?: string | null;
          password_hash?: string | null;
          extra_data?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      packages: {
        Row: {
          id: string;
          recipient_id: string | null;
          recipient_name: string;
          unit: string;
          type: string;
          received_at: string;
          display_time: string | null;
          status: 'pendente' | 'recebida';
          deadline_minutes: number;
          resident_phone: string | null;
          delivered_at: string | null;
          delivered_by: string | null;
          qr_code_data: string | null;
          image_url: string | null;
          oculta_para_morador?: boolean | null;
          data_recebimento?: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      boletos: {
        Row: {
          id: string;
          resident_id: string | null;
          resident_name: string;
          unit: string;
          reference_month: string;
          due_date: string;
          amount: number;
          status: 'Pendente' | 'Pago' | 'Vencido';
          boleto_type: 'condominio' | 'agua' | 'luz' | null;
          barcode: string | null;
          pdf_url: string | null;
          paid_date: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      notices: {
        Row: {
          id: string;
          title: string;
          content: string;
          author: string;
          author_role: 'SINDICO' | 'PORTEIRO' | 'MORADOR';
          author_id: string | null;
          date: string;
          category: 'Urgente' | 'Manutenção' | 'Social' | 'Institucional' | null;
          priority: 'high' | 'normal';
          pinned: boolean;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      reservations: {
        Row: {
          id: string;
          area_id: string;
          resident_id: string;
          resident_name: string;
          unit: string;
          date: string;
          start_time: string;
          end_time: string;
          status: 'scheduled' | 'active' | 'completed' | 'canceled';
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};