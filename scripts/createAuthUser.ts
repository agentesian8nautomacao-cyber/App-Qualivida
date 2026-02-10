import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Cria um usuário no Supabase Auth (admin) sem definir senha e salva o id em auth_user_id.
 * @param table - tabela alvo (ex: 'resident', 'staff', 'users')
 * @param rowId - id do registro na tabela alvo
 * @param email - email do usuário
 * @returns auth user id criado ou null em caso de falha
 */
export async function createAuthUserForRow(table: string, rowId: string | number, email: string): Promise<string | null> {
  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) throw new Error('Email inválido');

    // Criar usuário no Auth via admin com senha temporária
    // Gera senha temporária segura
    const tempPassword = generateTempPassword();
    const { data: createData, error: createError } = await (supabase.auth as any).admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true
    });

    if (createError) {
      console.error('Erro ao criar usuário no Auth:', createError);
      return null;
    }

    const authUserId = (createData?.user?.id ?? createData?.id) as string | undefined;
    if (!authUserId) {
      console.error('Não foi possível obter auth user id após criação.');
      return null;
    }

    // Atualizar a tabela com auth_user_id (não salvar senha em nenhuma tabela)
    const { error: updateError } = await supabase
      .from(table)
      .update({ auth_user_id: authUserId })
      .eq('id', rowId);

    if (updateError) {
      console.error(`Falha ao atualizar ${table} id=${rowId} com auth_user_id=${authUserId}:`, updateError);
      return null;
    }

    console.log(`Usuário criado no Auth: ${authUserId} -> ${table}.id=${rowId}`);
    // Retornar authUserId e senha temporária (senha só para uso do administrador no processo de notificação)
    // Atenção: não persistir senha em tabelas de domínio; salve resultado externamente (CSV) quando usar em massa.
    (createAuthUserForRow as any).lastTempPassword = tempPassword;
    return authUserId;
  } catch (err: any) {
    console.error('Erro inesperado em createAuthUserForRow:', err);
    return null;
  }
}

// CLI usage: node ./scripts/createAuthUser.js <table> <rowId> <email>
if (require.main === module) {
  (async () => {
    const [, , table, rowId, email] = process.argv;
    if (!table || !rowId || !email) {
      console.error('Uso: node ./scripts/createAuthUser.js <table> <rowId> <email>');
      process.exit(1);
    }
    const res = await createAuthUserForRow(table, rowId, email);
    if (!res) process.exit(2);
    console.log('auth_user_id:', res);
    console.log('temp_password (in-memory):', (createAuthUserForRow as any).lastTempPassword || '');
    process.exit(0);
  })();
}

/**
 * Gera senha temporária alfanumérica segura (12 chars)
 */
function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const array = new Uint32Array(length);
  // Node.js compatibility: use crypto from node
  // @ts-ignore
  const cryptoModule = typeof crypto !== 'undefined' ? crypto : require('crypto');
  const buf = cryptoModule.randomBytes(length);
  for (let i = 0; i < length; i++) {
    const idx = buf[i] % chars.length;
    out += chars.charAt(idx);
  }
  return out;
}

