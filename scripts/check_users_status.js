// Script para verificar status dos usuários no Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkUsersStatus() {
  try {
    console.log('🔍 Verificando status dos usuários...\n');

    // 1. Verificar moradores sem auth_user_id
    console.log('1. Moradores sem auth_user_id:');
    const { data: residentsWithoutAuth, error: resError } = await supabase
      .from('residents')
      .select('id, name, unit, email, auth_user_id')
      .is('auth_user_id', null)
      .not('email', 'is', null);

    if (resError) {
      console.error('Erro ao buscar moradores:', resError.message);
    } else {
      console.log(`Encontrados ${residentsWithoutAuth.length} moradores sem auth_user_id`);
      if (residentsWithoutAuth.length > 0) {
        console.log('Primeiros 3:');
        residentsWithoutAuth.slice(0, 3).forEach(r => {
          console.log(`  - ${r.name} (${r.unit}) - ${r.email}`);
        });
      }
    }

    console.log('\n2. Moradores COM auth_user_id:');
    const { data: residentsWithAuth, error: resWithError } = await supabase
      .from('residents')
      .select('id, name, unit, email, auth_user_id')
      .not('auth_user_id', 'is', null)
      .limit(5);

    if (resWithError) {
      console.error('Erro ao buscar moradores com auth:', resWithError.message);
    } else {
      console.log(`Encontrados ${residentsWithAuth.length} moradores com auth_user_id`);
      if (residentsWithAuth.length > 0) {
        residentsWithAuth.forEach(r => {
          console.log(`  - ${r.name} (${r.unit}) - ${r.email} -> auth_id: ${r.auth_user_id}`);
        });
      }
    }

    // 3. Testar se conseguimos fazer login com um morador que tem auth_user_id
    if (residentsWithAuth && residentsWithAuth.length > 0) {
      const testResident = residentsWithAuth[0];
      console.log(`\n3. Testando login do morador: ${testResident.name} (${testResident.unit})`);

      // Primeiro, buscar senha padrão ou algo que possa funcionar
      console.log('Tentando login com senha padrão "123456"...');

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: testResident.email,
        password: '123456'
      });

      if (authError) {
        console.log(`❌ Login falhou: ${authError.message}`);
      } else {
        console.log(`✅ Login bem-sucedido!`);
        console.log(`Usuário: ${authData.user?.email}`);
        console.log(`ID: ${authData.user?.id}`);

        // Fazer logout para limpar
        await supabase.auth.signOut();
      }
    }

  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

checkUsersStatus();