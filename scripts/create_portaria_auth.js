// Creates an auth user for portaria@example.com and updates users table row
const fetch = global.fetch;
const SUPABASE_URL = 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM5MTUzOSwiZXhwIjoyMDgyOTY3NTM5fQ.EGZDVfJW09KdttJm6UrGty7CZSatHoqhIBiwyOSF1yE';
const targetEmail = 'portaria@example.com';
const userId = 'dfc1507f-d1c6-4c37-bc0d-53af8bfef39e';

(async () => {
  try {
    console.log('Creating auth user for', targetEmail);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: targetEmail, email_confirm: true })
    });
    const createText = await res.text();
    console.log('createResp:', createText);
    let createJson;
    try { createJson = JSON.parse(createText); } catch (e) { console.error('Failed to parse create response'); process.exit(1); }
    const authId = createJson.id || (createJson.user && createJson.user.id);
    if (!authId) { console.error('No auth id returned'); process.exit(1); }
    console.log('authId =', authId);

    console.log('Updating users table for id', userId);
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ auth_user_id: authId })
    });
    const updText = await upd.text();
    console.log('updateResp:', updText);
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();

