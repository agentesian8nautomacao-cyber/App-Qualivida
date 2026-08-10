// scripts/set_auth_passwords.js
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM5MTUzOSwiZXhwIjoyMDgyOTY3NTM5fQ.EGZDVfJW09KdttJm6UrGty7CZSatHoqhIBiwyOSF1yE';

const users = [
  { id: '9ab3ffa6-5762-4700-9d19-758ad2f115a6', password: 'admin123', label: 'admin' },
  { id: '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a', password: 'dev123', label: 'desenvolvedor' },
  { id: '1368510e-329a-4ded-87ea-d606b24d2676', password: '123456', label: 'portaria' }
];

async function setPassword(user) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: user.password, email_confirm: true })
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

(async () => {
  for (const u of users) {
    try {
      console.log(`Setting password for ${u.label} (${u.id}) ...`);
      const result = await setPassword(u);
      console.log(u.label, '=>', result.status, result.body);
    } catch (err) {
      console.error('Error setting password for', u.label, err);
    }
  }
})();

