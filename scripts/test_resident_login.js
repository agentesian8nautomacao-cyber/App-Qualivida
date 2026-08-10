// Script para testar login de morador específico
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simular a função loginResident
async function testResidentLogin(unit, password) {
  try {
    console.log(`🔍 Testando login do morador: unidade "${unit}", senha "${password}"\n`);

    // Passo 1: Buscar morador pela unidade
    console.log('1. Buscando morador pela unidade...');
    const { data: allResidents, error: fetchError } = await supabase
      .from('residents')
      .select('id, name, unit, email, phone, whatsapp, extra_data, auth_user_id');

    if (fetchError) {
      console.error('❌ Erro ao buscar moradores:', fetchError.message);
      return { success: false, error: 'Erro ao buscar morador' };
    }

    if (!allResidents) {
      console.error('❌ Nenhum morador encontrado');
      return { success: false, error: 'Erro ao buscar morador' };
    }

    // Normalizar unidade (simular a função normalizeUnit)
    const normalizedUnit = unit.trim().toUpperCase().replace(/^0+/, '');
    console.log(`Unidade normalizada: "${normalizedUnit}"`);

    // Encontrar morador pela unidade
    const data = allResidents.find((r) => {
      // Simular compareUnits
      const residentUnit = (r.unit || '').trim().toUpperCase().replace(/^0+/, '');
      return residentUnit === normalizedUnit;
    });

    if (!data || !data.email) {
      console.log('❌ Morador não encontrado ou sem e-mail');
      console.log('Moradores encontrados:');
      allResidents.forEach(r => console.log(`  - ${r.name}: "${r.unit}" -> ${r.email || 'SEM EMAIL'}`));
      return { success: false, error: 'Unidade ou senha incorretos' };
    }

    console.log(`✅ Morador encontrado: ${data.name} (${data.unit}) - ${data.email}`);

    const email = String(data.email).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Morador sem e-mail cadastrado. Cadastre um e-mail para usar recuperação de senha.' };
    }

    // Verificar se tem auth_user_id
    if (!data.auth_user_id) {
      return { success: false, error: 'Morador não possui senha cadastrada. O síndico/porteiro deve recadastrar com senha, ou use "Criar conta" na tela de login.' };
    }

    console.log(`✅ Auth user ID: ${data.auth_user_id}`);

    // Passo 2: Tentar fazer login
    console.log('2. Tentando autenticação...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password.trim()
    });

    if (authError || !authData?.user?.id) {
      console.log(`❌ Login falhou: ${authError?.message || 'Erro desconhecido'}`);
      return { success: false, error: 'Unidade ou senha incorretos' };
    }

    console.log(`✅ Login bem-sucedido!`);
    console.log(`Usuário autenticado: ${authData.user.email} (ID: ${authData.user.id})`);

    // Fazer logout para limpar
    await supabase.auth.signOut();

    return {
      success: true,
      resident: {
        id: data.id,
        name: data.name,
        unit: data.unit,
        email: data.email || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        vehiclePlate: data.extra_data?.vehiclePlate || data.extra_data?.vehicle_plate || '',
        vehicleModel: data.extra_data?.vehicleModel || data.extra_data?.vehicle_model || '',
        vehicleColor: data.extra_data?.vehicleColor || data.extra_data?.vehicle_color || '',
        extraData: data.extra_data
      }
    };
  } catch (err) {
    console.error('❌ Erro geral:', err.message);
    return { success: false, error: err.message || 'Erro ao fazer login' };
  }
}

// Testes
async function runTests() {
  console.log('🚀 Iniciando testes de login de moradores...\n');

  // Teste 1: Morador que sabemos que existe
  const test1 = await testResidentLogin('03/005', '123456');
  console.log('Resultado teste 1:', test1.success ? 'SUCESSO' : 'FALHA');
  console.log('Erro:', test1.error || 'Nenhum');
  console.log('\n' + '='.repeat(50) + '\n');

  // Teste 2: Tentar outras senhas possíveis
  const possiblePasswords = ['123456', 'senha123', 'Qualivida2024', 'password', '123456789'];

  for (const pwd of possiblePasswords) {
    if (pwd === '123456') continue; // Já testamos
    console.log(`Testando senha: "${pwd}"`);
    const result = await testResidentLogin('03/005', pwd);
    if (result.success) {
      console.log(`🎉 SENHA ENCONTRADA: "${pwd}"`);
      break;
    }
  }

  console.log('\n🏁 Testes concluídos.');
}

runTests();