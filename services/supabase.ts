import { createClient } from '@supabase/supabase-js';

// Obter variáveis de ambiente
const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Garantir que a URL tenha https:// (correção automática)
let supabaseUrl = rawSupabaseUrl;
if (supabaseUrl) {
  // Remove http:// ou https:// se já existir para normalizar
  supabaseUrl = supabaseUrl.replace(/^https?:\/\//, '');
  // Adiciona https://
  supabaseUrl = `https://${supabaseUrl}`;
  // Remove barra no final se houver
  supabaseUrl = supabaseUrl.replace(/\/$/, '');
}

// Logs de debug (sempre, para ajudar a diagnosticar)
const envMode = import.meta.env.MODE || 'unknown';
console.log(`[Supabase Config] Mode: ${envMode}`);
console.log(`[Supabase Config] URL original:`, rawSupabaseUrl || 'NÃO DEFINIDA');
console.log(`[Supabase Config] URL processada:`, supabaseUrl || 'NÃO DEFINIDA');
console.log(`[Supabase Config] Key:`, supabaseAnonKey ? '✅ Configurada' : '❌ Não configurada');

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = '❌ Variáveis de ambiente do Supabase não configuradas!\n' +
    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY\n' +
    'No Vercel: Settings > Environment Variables > Redeploy após adicionar\n' +
    'Localmente: arquivo .env.local';
  console.error(errorMsg);
}

// Criar cliente Supabase (mesmo que as variáveis estejam vazias, para evitar erros)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

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
          status: 'Pendente' | 'Entregue';
          deadline_minutes: number;
          resident_phone: string | null;
          delivered_at: string | null;
          delivered_by: string | null;
          qr_code_data: string | null;
          image_url: string | null;
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