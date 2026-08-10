/**
 * Script para testar login dos usuários admin padrão
 * Verifica se existem no Supabase Auth e se conseguem fazer login
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Usuários padrão para testar
const testUsers = [
  {
    username: 'desenvolvedor',
    password: 'dev123',
    email: 'agentesian8nautomacao@gmail.com',
    auth_user_id: '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a'
  },
  {
    username: 'admin',
    password: 'admin123',
    email: 'paulohmorais@hotmail.com',
    auth_user_id: '9ab3ffa6-5762-4700-9d19-758ad2f115a6'
  },
  {
    username: 'portaria',
    password: 'plain:123456',
    email: 'paulohmorais@hotmail.com',
    auth_user_id: '1368510e-329a-4ded-87ea-d606b24d2676'
  }
];

async function checkUserInAuth(user) {
  console.log(`\n🔍 Verificando usuário: ${user.username}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Auth User ID: ${user.auth_user_id}`);

  try {
    // 1. Verificar se existe na tabela users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', user.username)
      .maybeSingle();

    if (userError) {
      console.log(`   ❌ Erro ao buscar usuário na tabela users: ${userError.message}`);
      return false;
    }

    if (!userData) {
      console.log(`   ❌ Usuário ${user.username} não encontrado na tabela users`);
      return false;
    }

    console.log(`   ✅ Usuário encontrado na tabela users`);
    console.log(`      ID: ${userData.id}`);
    console.log(`      Role: ${userData.role}`);
    console.log(`      Auth User ID: ${userData.auth_user_id}`);

    // 2. Verificar se o auth_user_id existe no Supabase Auth
    if (userData.auth_user_id) {
      console.log(`   🔍 Verificando se auth_user_id existe no Supabase Auth...`);

      // Tentar fazer login
      const cleanPassword = user.password.replace('plain:', '');
      console.log(`   🔐 Tentando login com email: ${userData.email || user.email}, senha: ${cleanPassword}`);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userData.email || user.email,
        password: cleanPassword
      });

      if (authError) {
        console.log(`   ❌ Erro de autenticação: ${authError.message}`);
        console.log(`   💡 Possíveis causas:`);
        console.log(`      - Senha incorreta`);
        console.log(`      - Usuário não existe no auth.users`);
        console.log(`      - Email não confirmado`);
        return false;
      }

      if (authData?.user) {
        console.log(`   ✅ Login bem-sucedido!`);
        console.log(`      User ID: ${authData.user.id}`);
        console.log(`      Email: ${authData.user.email}`);

        // Fazer logout para limpar
        await supabase.auth.signOut();
        return true;
      }
    } else {
      console.log(`   ⚠️ Usuário não tem auth_user_id - precisa migrar para Supabase Auth`);
      return false;
    }

  } catch (error) {
    console.log(`   ❌ Erro inesperado: ${error.message}`);
    return false;
  }

  return false;
}

async function main() {
  console.log('🚀 Testando login dos usuários admin padrão\n');

  let successCount = 0;

  for (const user of testUsers) {
    const success = await checkUserInAuth(user);
    if (success) successCount++;
  }

  console.log(`\n📊 Resultado: ${successCount}/${testUsers.length} usuários podem fazer login`);

  if (successCount === 0) {
    console.log('\n❌ Nenhum usuário conseguiu fazer login!');
    console.log('💡 Possíveis soluções:');
    console.log('   1. Verificar se as senhas estão corretas');
    console.log('   2. Migrar usuários para Supabase Auth');
    console.log('   3. Verificar se os emails estão confirmados');
    console.log('   4. Usar o script de migração: node scripts/migrate_auth_login.cjs');
  } else if (successCount < testUsers.length) {
    console.log('\n⚠️ Alguns usuários não conseguiram fazer login');
    console.log('💡 Execute: node scripts/migrate_auth_login.cjs');
  } else {
    console.log('\n✅ Todos os usuários estão funcionando!');
  }
}

main().catch(console.error);