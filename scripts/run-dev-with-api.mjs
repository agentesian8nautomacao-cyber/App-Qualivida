/**
 * Sobe o Vite e a API de convite (staff-invite) juntos.
 * Útil para testar o link de convite em desenvolvimento sem abrir dois terminais.
 * Uso: npm run dev:all
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const api = spawn('node', ['scripts/dev-api-staff-invite.mjs'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const vite = spawn('npx', ['vite', '--config', 'vite.config.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

function killAll() {
  api.kill('SIGTERM');
  vite.kill('SIGTERM');
}

api.on('error', (err) => {
  console.error('[dev:all] Erro ao iniciar API:', err.message);
});
vite.on('error', (err) => {
  console.error('[dev:all] Erro ao iniciar Vite:', err.message);
});

vite.on('exit', (code) => {
  killAll();
  process.exit(code ?? 0);
});

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
