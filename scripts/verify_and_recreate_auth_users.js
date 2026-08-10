/**
 * Script para verificar e recriar usuários no Supabase Auth
 * Para usuários que têm auth_user_id mas não conseguem fazer login
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Usuários para verificar/recuperar
const usersToFix = [
  {
    id: '4fd1744a-55ef-4264-bce0-037c00af90aa',
    username: 'desenvolvedor',
    email: 'agentesian8nautomacao@gmail.com',
    password: 'dev123',
    role: 'SINDICO',
    auth_user_id: '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a'
  },
  {
    id: 'b889ac45-2362-4247-9dd9-ef5d104ab81b',
    username: 'admin',
    email: 'paulohmorais@hotmail.com',
    password: 'admin123',
    role: 'SINDICO',
    auth_user_id: '9ab3ffa6-5762-4700-9d19-758ad2f115a6'
  },
  {
    id: 'dfc1507f-d1c6-4c37-bc0d-53af8bfef39e',
    username: 'portaria',
    email: 'paulohmorais@hotmail.com',
    password: '123456',
    role: 'PORTEIRO',
    auth_user_id: '1368510e-329a-4ded-87ea-d606b24d2676'
  }
];

async function recreateUserInAuth(user) {
  console.log(`\n🔄 Recriando usuário: ${user.username} (${user.email})`);

  try {
    // 1. Tentar fazer signUp com email diferente para evitar conflito
    const uniqueEmail = `${user.username}_${Date.now()}@temp.local`;

    console.log(`   📧 Usando email temporário: ${uniqueEmail}`);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: uniqueEmail,
      password: user.password,
      options: {
        data: {
          username: user.username,
          role: user.role,
          original_email: user.email
        }
      }
    });

    if (signUpError) {
      console.log(`   ❌ Erro no signUp: ${signUpError.message}`);
      return null;
    }

    if (!signUpData?.user?.id) {
      console.log(`   ❌ SignUp falhou - nenhum user ID retornado`);
      return null;
    }

    console.log(`   ✅ Novo usuário criado no Auth com ID: ${signUpData.user.id}`);

    // 2. Agora atualizar a tabela users para usar o novo auth_user_id
    const { error: updateError } = await supabase
      .from('users')
      .update({
        auth_user_id: signUpData.user.id,
        email: uniqueEmail // temporário
      })
      .eq('id', user.id);

    if (updateError) {
      console.log(`   ❌ Erro ao atualizar tabela users: ${updateError.message}`);
      return null;
    }

    console.log(`   ✅ Tabela users atualizada`);

    // 3. Agora tentar atualizar o email para o original (se possível)
    console.log(`   🔄 Tentando atualizar email para: ${user.email}`);

    const { error: updateEmailError } = await supabase.auth.updateUser({
      email: user.email
    });

    if (updateEmailError) {
      console.log(`   ⚠️ Não foi possível atualizar email: ${updateEmailError.message}`);
      console.log(`   💡 Usuário pode fazer login com: ${uniqueEmail}`);
    } else {
      console.log(`   ✅ Email atualizado para: ${user.email}`);

      // Atualizar na tabela também
      await supabase
        .from('users')
        .update({ email: user.email })
        .eq('id', user.id);
    }

    // Fazer logout
    await supabase.auth.signOut();

    return {
      newAuthUserId: signUpData.user.id,
      email: updateEmailError ? uniqueEmail : user.email
    };

  } catch (error) {
    console.log(`   ❌ Erro inesperado: ${error.message}`);
    return null;
  }
}

async function forceRecreateUser(user) {
  console.log(`\n💪 Forçando recriação do usuário: ${user.username}`);

  try {
    // Primeiro, tentar deletar o auth_user_id antigo da tabela (não do auth)
    const { error: clearError } = await supabase
      .from('users')
      .update({ auth_user_id: null })
      .eq('id', user.id);

    if (clearError) {
      console.log(`   ⚠️ Erro ao limpar auth_user_id: ${clearError.message}`);
    }

    // Agora recriar
    const result = await recreateUserInAuth(user);
    return result;

  } catch (error) {
    console.log(`   ❌ Erro na recriação forçada: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🔍 Verificando e recriando usuários no Supabase Auth...\n');

  let successCount = 0;

  for (const user of usersToFix) {
    console.log(`\n🎯 Processando: ${user.username}`);

    // Verificar status atual
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError || !currentUser) {
      console.log(`   ❌ Erro ao buscar usuário na tabela: ${fetchError?.message || 'Usuário não encontrado'}`);
      continue;
    }

    console.log(`   📊 Status atual:`);
    console.log(`      Auth User ID: ${currentUser.auth_user_id || 'NULO'}`);
    console.log(`      Email: ${currentUser.email || 'NULO'}`);

    // Tentar login para verificar se funciona
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: currentUser.email || user.email,
      password: user.password
    });

    if (loginError) {
      console.log(`   ❌ Login falha: ${loginError.message}`);
      console.log(`   🔄 Tentando recriar usuário...`);

      const recreateResult = await forceRecreateUser(user);
      if (recreateResult) {
        console.log(`   ✅ Usuário recriado com sucesso!`);
        console.log(`      Novo Auth ID: ${recreateResult.newAuthUserId}`);
        console.log(`      Email para login: ${recreateResult.email}`);
        successCount++;
      } else {
        console.log(`   ❌ Falha na recriação`);
      }
    } else {
      console.log(`   ✅ Login funcionando! Usuário OK`);
      await supabase.auth.signOut();
      successCount++;
    }
  }

  console.log(`\n📊 Resultado Final: ${successCount}/${usersToFix.length} usuários funcionando`);

  if (successCount > 0) {
    console.log('\n🎉 Usuários corrigidos! Teste o login:');
    console.log('   node scripts/test_admin_users_login.js');
  } else {
    console.log('\n❌ Problema persistente. Verifique:');
    console.log('   1. Configurações do Supabase Auth');
    console.log('   2. Políticas de segurança');
    console.log('   3. Limites de taxa');
  }
}

main().catch(console.error);