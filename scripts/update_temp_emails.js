/**
 * Script para atualizar emails temporários na tabela users
 * Permite login com os emails temporários criados
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mapeamento de usuários e seus emails temporários
const tempEmailMapping = {
  'desenvolvedor': 'desenvolvedor_1770855326477@temp.local',
  'admin': 'admin_1770855328329@temp.local',
  'portaria': 'portaria_1770855330070@temp.local'
};

async function updateTempEmails() {
  console.log('🔄 Atualizando emails temporários na tabela users...\n');

  for (const [username, tempEmail] of Object.entries(tempEmailMapping)) {
    console.log(`📧 Atualizando ${username} → ${tempEmail}`);

    try {
      const { data, error } = await supabase
        .from('users')
        .update({ email: tempEmail })
        .eq('username', username)
        .select();

      if (error) {
        console.log(`   ❌ Erro: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`   ✅ Atualizado com sucesso`);
      } else {
        console.log(`   ⚠️ Nenhum registro encontrado`);
      }
    } catch (error) {
      console.log(`   ❌ Erro inesperado: ${error.message}`);
    }
  }

  console.log('\n🎯 Emails temporários atualizados!');
  console.log('\n🔑 Credenciais para login:');
  console.log('┌─────────────────┬─────────────────────────────────────┬────────────┐');
  console.log('│ Usuário         │ Email temporário                   │ Senha      │');
  console.log('├─────────────────┼─────────────────────────────────────┼────────────┤');
  console.log('│ desenvolvedor   │ desenvolvedor_1770855326477@temp.local │ dev123     │');
  console.log('│ admin           │ admin_1770855328329@temp.local      │ admin123   │');
  console.log('│ portaria        │ portaria_1770855330070@temp.local   │ 123456     │');
  console.log('└─────────────────┴─────────────────────────────────────┴────────────┘');

  console.log('\n💡 IMPORTANTE:');
  console.log('   - Use os emails temporários acima para fazer login');
  console.log('   - Estes emails são válidos apenas para autenticação');
  console.log('   - Para emails reais, será necessário configurar SMTP');
  console.log('\n🧪 Teste: node scripts/test_admin_users_login.js');
}

updateTempEmails().catch(console.error);