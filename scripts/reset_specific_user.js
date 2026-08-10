// Script para enviar link de reset de senha para um usuário específico
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESET_REDIRECT = process.env.RESET_REDIRECT || 'https://qualivida-club-residence.vercel.app/reset-password';

// Email do usuário que precisa do reset
const USER_EMAIL = process.argv[2];

if (!SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('Exemplo: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/reset_specific_user.js email@exemplo.com');
  process.exit(1);
}

if (!USER_EMAIL) {
  console.error('Uso: node scripts/reset_specific_user.js email@exemplo.com');
  console.error('Exemplo: node scripts/reset_specific_user.js usuario@email.com');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

(async () => {
  try {
    console.log(`Enviando link de reset para: ${USER_EMAIL}`);
    console.log(`Redirect URL: ${RESET_REDIRECT}`);

    const { error } = await supabase.auth.resetPasswordForEmail(USER_EMAIL, {
      redirectTo: RESET_REDIRECT
    });

    if (error) {
      console.error('Erro ao enviar reset:', error.message);
      process.exit(1);
    }

    console.log('✅ Link de reset enviado com sucesso!');
    console.log('Verifique a caixa de entrada, spam e promoções do Gmail.');
    console.log('O link expira em cerca de 1 hora.');

  } catch (err) {
    console.error('Erro inesperado:', err);
    process.exit(1);
  }
})();