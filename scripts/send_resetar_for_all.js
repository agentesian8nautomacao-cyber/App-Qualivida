// scripts/send_resets_for_all.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REDIRECT_TO = process.env.RESET_REDIRECT || 'http://localhost:3008/reset-password'; // ajuste se necessário

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

(async () => {
  try {
    // Buscar emails únicos com auth_user_id preenchido nas duas tabelas
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('email')
      .not('email', 'is', null)
      .not('auth_user_id', 'is', null);

    if (usersErr) throw usersErr;

    const { data: residents, error: residentsErr } = await supabase
      .from('residents')
      .select('email')
      .not('email', 'is', null)
      .not('auth_user_id', 'is', null);

    if (residentsErr) throw residentsErr;

    const emails = new Set([
      ...(users || []).map(r => r.email?.toString().trim().toLowerCase()).filter(Boolean),
      ...(residents || []).map(r => r.email?.toString().trim().toLowerCase()).filter(Boolean),
    ]);

    if (emails.size === 0) {
      console.log('Nenhum email encontrado com auth_user_id preenchido.');
      process.exit(0);
    }

    console.log(`Enviando reset para ${emails.size} email(s). RedirectTo: ${REDIRECT_TO}`);

    for (const email of emails) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_TO });
      if (error) {
        console.error(email, '-> erro:', error.message || error);
      } else {
        console.log(email, '-> reset enviado');
      }
      // opcional: aguardar 200ms entre envios para evitar limitação
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('Envios concluídos.');
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err);
    process.exit(2);
  }
})();