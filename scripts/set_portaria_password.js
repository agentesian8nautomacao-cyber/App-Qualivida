// scripts/set_portaria_password.js
import fetch from 'node-fetch';

const SUPABASE_URL = 'https://zaemlxjwhzrfmowbckmk.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW1seGp3aHpyZm1vd2Jja21rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzM5MTUzOSwiZXhwIjoyMDgyOTY3NTM5fQ.EGZDVfJW09KdttJm6UrGty7CZSatHoqhIBiwyOSF1yE';
const userId = '1368510e-329a-4ded-87ea-d606b24d2676'; // auth user id for portaria
const password = 'Portaria123';

async function setPassword() {
  try {
    const url = `${SUPABASE_URL}/auth/v1/admin/users/${userId}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password, email_confirm: true })
    });
    const text = await res.text();
    console.log('status:', res.status);
    console.log('body:', text);
  } catch (err) {
    console.error('error:', err);
  }
}

setPassword();

