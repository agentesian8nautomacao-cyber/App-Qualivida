const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateTable(tableName) {
  console.log(`\n--- Migrating table: ${tableName}`);
  const { data: rows, error: selectError } = await supabase.from(tableName).select('*').is('auth_user_id', null);
  if (selectError) {
    console.error(`Erro ao buscar rows em ${tableName}:`, selectError);
    return;
  }
  if (!rows || rows.length === 0) {
    console.log(`Nenhum registro sem auth_user_id em ${tableName}`);
    return;
  }

  for (const r of rows) {
    try {
      const email = (r.email || '').toString().trim().toLowerCase();
      if (!email) {
        console.warn(`Skipping id=${r.id} (no email)`);
        continue;
      }

      // Try to create user in Auth (admin)
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true
      });

      if (createError) {
        console.warn(`createUser failed for ${email}:`, createError.message || createError);
        // try to find existing auth user by email
        try {
          const { data: authList, error: listErr } = await supabase.auth.admin.listUsers();
          if (listErr) {
            console.warn('Could not list auth users:', listErr);
          } else {
            const listUsers = authList?.users || authList || [];
            const found = listUsers.find(u => (u.email || '').toLowerCase() === email);
            if (found) {
              const authUserId = found.id || found.user?.id;
              console.log(`Found existing auth user for ${email}: ${authUserId}`);
              await supabase.from(tableName).update({ auth_user_id: authUserId }).eq('id', r.id);
              continue;
            }
          }
        } catch (e) {
          console.warn('Error while attempting to find existing auth user:', e);
        }
        continue;
      }

      const authUserId = (createData?.user?.id ?? createData?.id);
      if (!authUserId) {
        console.error(`No auth id returned for ${email}`);
        continue;
      }

      const { error: updateError } = await supabase.from(tableName).update({ auth_user_id: authUserId }).eq('id', r.id);
      if (updateError) {
        console.error(`Failed to update ${tableName} id=${r.id} with auth_user_id=${authUserId}:`, updateError);
        continue;
      }

      console.log(`Migrated ${tableName} id=${r.id} -> auth_user_id=${authUserId}`);
    } catch (err) {
      console.error(`Erro ao processar registro id=${r.id}:`, err);
    }
  }
}

(async () => {
  try {
    // Try common table names (singular/plural) in sequence
    const tablesToTry = ['resident', 'residents', 'staff', 'users'];
    for (const t of tablesToTry) {
      await migrateTable(t);
    }

    console.log('\nMigration completa.');
    process.exit(0);
  } catch (e) {
    console.error('Erro na migration geral:', e);
    process.exit(2);
  }
})();

