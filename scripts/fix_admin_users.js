/**
 * Script para corrigir os usuários admin padrão
 * Cria usuários no Supabase Auth se não existirem
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Usuários padrão para corrigir
const adminUsers = [
  {
    username: 'desenvolvedor',
    password: 'dev123',
    email: 'agentesian8nautomacao@gmail.com',
    role: 'SINDICO'
  },
  {
    username: 'admin',
    password: 'admin123',
    email: 'paulohmorais@hotmail.com',
    role: 'SINDICO'
  },
  {
    username: 'portaria',
    password: '123456',
    email: 'paulohmorais@hotmail.com',
    role: 'PORTEIRO'
  }
];

async function fixUser(user) {
  console.log(`\n🔧 Corrigindo usuário: ${user.username}`);

  try {
    // 1. Verificar se já existe na tabela users
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('username', user.username)
      .maybeSingle();

    if (fetchError) {
      console.log(`   ❌ Erro ao buscar usuário: ${fetchError.message}`);
      return false;
    }

    if (!existingUser) {
      console.log(`   ⚠️ Usuário ${user.username} não encontrado na tabela users`);
      console.log(`   💡 Criando usuário na tabela users primeiro...`);

      // Criar na tabela users
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          username: user.username,
          password_hash: user.password, // será migrado depois
          role: user.role,
          name: user.username.charAt(0).toUpperCase() + user.username.slice(1),
          email: user.email,
          phone: '',
          is_active: true
        })
        .select()
        .single();

      if (createError) {
        console.log(`   ❌ Erro ao criar usuário na tabela: ${createError.message}`);
        return false;
      }

      console.log(`   ✅ Usuário criado na tabela users com ID: ${newUser.id}`);
      existingUser = newUser;
    }

    // 2. Verificar se já tem auth_user_id
    if (existingUser.auth_user_id) {
      console.log(`   ℹ️ Usuário já tem auth_user_id: ${existingUser.auth_user_id}`);
      console.log(`   🔍 Testando login...`);

      // Testar login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password
      });

      if (authError) {
        console.log(`   ❌ Login falhou: ${authError.message}`);
        console.log(`   💡 Usuário pode precisar ser recriado no Supabase Auth`);
        return false;
      } else {
        console.log(`   ✅ Login funcionando!`);
        await supabase.auth.signOut();
        return true;
      }
    }

    // 3. Criar usuário no Supabase Auth (usando signUp)
    console.log(`   🔐 Criando usuário no Supabase Auth...`);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: user.email,
      password: user.password,
      options: {
        data: {
          username: user.username,
          role: user.role
        }
      }
    });

    if (signUpError) {
      console.log(`   ❌ Erro ao criar no Supabase Auth: ${signUpError.message}`);

      // Se já existe, tentar login
      if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
        console.log(`   ℹ️ Usuário já existe no Supabase Auth, tentando login...`);

        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: user.password
        });

        if (loginError) {
          console.log(`   ❌ Login também falhou: ${loginError.message}`);
          return false;
        }

        console.log(`   ✅ Login bem-sucedido!`);
        const authUserId = loginData.user?.id;

        // Atualizar auth_user_id na tabela users
        if (authUserId) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ auth_user_id: authUserId })
            .eq('id', existingUser.id);

          if (updateError) {
            console.log(`   ⚠️ Erro ao atualizar auth_user_id: ${updateError.message}`);
          } else {
            console.log(`   ✅ Auth User ID atualizado: ${authUserId}`);
          }
        }

        await supabase.auth.signOut();
        return true;
      }

      return false;
    }

    if (signUpData?.user?.id) {
      console.log(`   ✅ Usuário criado no Supabase Auth com ID: ${signUpData.user.id}`);

      // Atualizar auth_user_id na tabela users
      const { error: updateError } = await supabase
        .from('users')
        .update({ auth_user_id: signUpData.user.id })
        .eq('id', existingUser.id);

      if (updateError) {
        console.log(`   ⚠️ Erro ao atualizar auth_user_id: ${updateError.message}`);
      } else {
        console.log(`   ✅ Auth User ID atualizado na tabela users`);
      }

      return true;
    }

  } catch (error) {
    console.log(`   ❌ Erro inesperado: ${error.message}`);
    return false;
  }

  return false;
}

async function main() {
  console.log('🔧 Corrigindo usuários admin padrão...\n');
  console.log('⚠️ NOTA: Este script cria usuários no Supabase Auth usando signUp');
  console.log('   Os emails precisarão ser confirmados se a confirmação estiver habilitada\n');

  let successCount = 0;

  for (const user of adminUsers) {
    const success = await fixUser(user);
    if (success) successCount++;
  }

  console.log(`\n📊 Resultado: ${successCount}/${adminUsers.length} usuários corrigidos`);

  if (successCount > 0) {
    console.log('\n✅ Usuários corrigidos! Teste o login novamente.');
    console.log('💡 Execute: node scripts/test_admin_users_login.js');
  } else {
    console.log('\n❌ Nenhum usuário pôde ser corrigido automaticamente.');
    console.log('💡 Verifique as configurações do Supabase Auth');
  }
}

main().catch(console.error);