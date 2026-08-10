/**
 * Script para testar o fluxo "Esqueci minha senha" para Morador
 * 
 * Este script verifica:
 * 1. Se existe morador com unidade/email em residents
 * 2. Se o e-mail existe em auth.users (necessário para Supabase enviar o link)
 * 3. Se a chamada resetPasswordForEmail é aceita
 * 
 * Uso: node scripts/test_forgot_password_resident.js [unidade ou email]
 * Exemplo: node scripts/test_forgot_password_resident.js 03/005
 * Exemplo: node scripts/test_forgot_password_resident.js paulohmorais@hotmail.com
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczOTE1MzksImV4cCI6MjA4Mjk2NzUzOX0.5HGtQM_NPb5nKD6ynHNJdYE567A0yJ2pOgs5ybTVs50';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function normalizeUnit(unit) {
  if (!unit || typeof unit !== 'string') return '';
  return unit.trim().toUpperCase().replace(/^0+/, '');
}

function compareUnits(a, b) {
  const na = normalizeUnit(a);
  const nb = normalizeUnit(b);
  return na === nb;
}

async function getEmailForResetResident(unitOrEmail) {
  const value = (unitOrEmail || '').trim();
  const q = value.toLowerCase();
  const isEmail = q.includes('@');
  try {
    if (isEmail) {
      const { data } = await supabase
        .from('residents')
        .select('email')
        .eq('email', q)
        .maybeSingle();
      return data?.email ?? null;
    }
    const normalizedUnit = normalizeUnit(value);
    if (!normalizedUnit) return null;
    const { data } = await supabase
      .from('residents')
      .select('email')
      .eq('unit', normalizedUnit)
      .maybeSingle();
    if (data?.email) return data.email;
    const { data: byRaw } = await supabase
      .from('residents')
      .select('email')
      .eq('unit', value)
      .maybeSingle();
    return byRaw?.email ?? null;
  } catch (err) {
    console.warn('getEmailForResetResident:', err);
    return null;
  }
}

async function testForgotPassword(unitOrEmail) {
  const value = (unitOrEmail || '').trim();
  if (!value) {
    console.error('❌ Informe a unidade ou e-mail: node scripts/test_forgot_password_resident.js 03/005');
    process.exit(1);
  }

  console.log('\n🔐 Teste: Fluxo "Esqueci minha senha" (Morador)\n');
  console.log(`Entrada: "${value}"\n`);

  // 1. Resolver unidade/email para e-mail
  console.log('1. Buscando e-mail em residents...');
  const email = await getEmailForResetResident(value);
  if (!email) {
    console.error('❌ E-mail não encontrado em residents para essa unidade ou e-mail.');
    console.log('\nMoradores disponíveis:');
    const { data: residents } = await supabase.from('residents').select('unit, email, name');
    residents?.forEach(r => console.log(`   ${r.unit} - ${r.email || 'SEM EMAIL'} (${r.name})`));
    process.exit(1);
  }
  console.log(`   ✅ E-mail encontrado: ${email}\n`);

  // 2. Verificar se morador tem auth_user_id
  const { data: resident } = await supabase
    .from('residents')
    .select('id, unit, email, auth_user_id')
    .eq('email', email)
    .maybeSingle();

  if (!resident?.auth_user_id) {
    console.error('❌ Morador não possui auth_user_id. O morador precisa estar em auth.users.');
    console.log('   Use "Criar conta" na tela de login ou migre o morador para Auth.');
    process.exit(1);
  }
  console.log(`2. Morador tem auth_user_id: ${resident.auth_user_id} ✅\n`);

  // 3. Solicitar reset (Supabase Auth)
  const redirectTo = 'http://localhost:3008/reset-password';
  console.log(`3. Enviando solicitação de recuperação (redirectTo: ${redirectTo})...`);

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo
  });

  if (error) {
    console.error('❌ Erro ao solicitar recuperação:', error.message);
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('redirect') || msg.includes('url')) {
      console.log('\n   💡 Adicione na lista de Redirect URLs do Supabase:');
      console.log('      Dashboard → Authentication → URL Configuration → Redirect URLs');
      console.log(`      - ${redirectTo}`);
      console.log('      - http://localhost:3008');
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      console.log('\n   💡 Limite de e-mails atingido. Aguarde ou configure SMTP personalizado.');
    }
    if (msg.includes('error sending') || msg.includes('recovery email')) {
      console.log('\n   💡 "Error sending recovery email" — causas comuns:');
      console.log('      1. Redirect URL: Adicione em Supabase → Authentication → URL Configuration:');
      console.log('         - http://localhost:3008/reset-password');
      console.log('         - http://localhost:3009/reset-password (porta alternativa)');
      console.log('      2. SMTP: O e-mail padrão do Supabase pode falhar (Gmail/Hotmail bloqueiam).');
      console.log('         Configure SMTP personalizado em Authentication → E-mails (veja CONFIGURAR_SMTP_SUPABASE.md)');
      console.log('      3. Rate limit: 2 e-mails/h com SMTP padrão. Aguarde ou configure SMTP.');
    }
    process.exit(1);
  }

  console.log('   ✅ Solicitação aceita! O Supabase deve enviar o e-mail.');
  console.log('\n📧 Próximos passos:');
  console.log('   1. Verifique a caixa de entrada e pasta Spam do e-mail:', email);
  console.log('   2. Clique no link de recuperação no e-mail');
  console.log('   3. O link deve abrir', redirectTo, 'com o hash de recovery');
  console.log('   4. Defina a nova senha (6-32 caracteres, letras e números)');
  console.log('   5. Faça login com unidade + nova senha\n');
  console.log('Para verificar se o Supabase processou:');
  console.log('   Dashboard → Authentication → Logs → evento user_recovery_requested\n');
}

const arg = process.argv[2];
testForgotPassword(arg);
