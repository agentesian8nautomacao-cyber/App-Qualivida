/**
 * Roda o build do Vite usando npx (usa o vite de node_modules/.bin).
 * Config: vite.config.mjs para usar sintaxe ESM.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'vite.config.mjs');

const r = spawnSync('npx', ['vite', 'build', '--config', configPath], {
  stdio: 'inherit',
  shell: true,
  cwd: root
});

process.exit(r.status !== 0 ? (r.status || 1) : 0);
