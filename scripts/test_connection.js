// Script simples para testar conexão com Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    console.log('🔍 Testando conexão com Supabase...');
    console.log(`URL: ${SUPABASE_URL}`);
    console.log(`Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...`);

    // Teste básico: tentar buscar moradores
    console.log('\n📋 Testando consulta de moradores...');
    const { data: residents, error: residentsError } = await supabase
      .from('residents')
      .select('id, name, unit, email')
      .limit(3);

    if (residentsError) {
      console.error('❌ Erro ao buscar moradores:', residentsError.message);
      console.error('Detalhes do erro:', residentsError);
    } else {
      console.log('✅ Consulta de moradores OK');
      console.log(`Encontrados ${residents.length} moradores (limit 3)`);
      if (residents.length > 0) {
        console.log('Primeiro morador:', residents[0]);
      }
    }

    // Teste de auth: tentar fazer sign in com credenciais inválidas (deve falhar)
    console.log('\n🔐 Testando autenticação (deve falhar)...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@invalido.com',
      password: 'senha_teste_invalida'
    });

    if (authError) {
      console.log('✅ Auth funcionando (erro esperado):', authError.message);
    } else {
      console.log('⚠️ Auth retornou sucesso com credenciais inválidas');
    }

  } catch (err) {
    console.error('❌ Erro geral:', err.message);
  }
}

testConnection();