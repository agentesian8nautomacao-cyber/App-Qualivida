/**
 * Roda o build do Vite usando npx (usa o vite de node_modules/.bin).
 * Sem --config: Vite usa vite.config.ts na raiz (evita ERR_MODULE_NOT_FOUND em ESM).
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const r = spawnSync('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  cwd: root
});

process.exit(r.status !== 0 ? (r.status || 1) : 0);
