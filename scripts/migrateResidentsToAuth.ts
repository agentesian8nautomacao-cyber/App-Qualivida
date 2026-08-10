
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
  // Buscar todos os registros da tabela `residents`
  const { data: residents, error: selectError } = await supabase.from('residents').select('*');
  if (selectError) {
    console.error('Erro ao buscar residents:', selectError);
    process.exit(1);
  }
  if (!residents || residents.length === 0) {
    console.log('Nenhum resident encontrado.');
    return;
  }

  for (const r of residents) {
    try {
      if (!r.email) {
        console.warn(`Resident id=${r.id} não tem email, pulando.`);
        continue;
      }

      // Gerar senha temporária aleatória
      const tempPassword = crypto.randomBytes(12).toString('hex');

      // Criar usuário no Auth com admin.createUser
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: String(r.email),
        password: tempPassword,
        email_confirm: true,
      } as any);

      if (createError) {
        console.error(`Falha ao criar usuário para resident id=${r.id} email=${r.email}:`, createError);
        continue;
      }

      const authUserId = userData?.user?.id ?? userData?.id;
      if (!authUserId) {
        console.error(`Não foi possível obter auth user id para resident id=${r.id}`);
        continue;
      }

      // Salvar auth_user.id em resident.auth_user_id
      const { error: updateError } = await supabase
        .from('residents')
        .update({ auth_user_id: authUserId })
        .eq('id', r.id);

      if (updateError) {
        console.error(`Falha ao atualizar resident id=${r.id} com auth_user_id=${authUserId}:`, updateError);
        continue;
      }

      console.log(`Migrado resident id=${r.id} -> auth_user_id=${authUserId}`);
    } catch (err) {
      console.error(`Erro ao processar resident id=${r.id}:`, err);
    }
  }
}

// Apenas exportar a função para uso manual; não executar automaticamente.
export default migrate;

