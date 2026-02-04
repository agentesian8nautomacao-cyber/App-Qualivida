import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// PWA desativado para deploy Vercel; removido do plugins para evitar ENOENT em register.js
// import { VitePWA } from 'vite-plugin-pwa';

const DEV_PORT = 3007;

/** Warmup + abre o navegador na URL/porta real em que o servidor subiu. */
function warmupAndOpenPlugin(): import('vite').Plugin {
  return {
    name: 'warmup-and-open',
    apply: 'serve' as const,
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : DEV_PORT;
        const url = `http://localhost:${port}/`;
        fetch(url).catch(() => {});
        setTimeout(() => {
          import('node:child_process').then(({ exec }) => {
            const cmd = process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
            exec(cmd, () => {});
          }).catch(() => {});
        }, 1500);
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente
  // loadEnv: .env, .env.local (local). process.env: Vercel e variáveis do sistema.
  // Usar process.env só quando o valor for não vazio, senão manter loadEnv.
  const loaded = loadEnv(mode, process.cwd(), '');
  const env: Record<string, string | undefined> = { ...loaded };
  for (const [k, v] of Object.entries(process.env)) {
    if (v != null && String(v).trim() !== '') env[k] = v;
  }

  // Base da API para desenvolvimento:
  // - Preferir VITE_API_BASE_URL (usada pelo frontend)
  // - Fallback para APP_URL (domínio público configurado no .env.local)
  const rawApiBase = (env.VITE_API_BASE_URL || env.APP_URL || '')?.toString().trim();
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';
  // GEMINI_API_KEY não é exposta ao client; a IA roda no backend (/api/ai).
  return {
    base: '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['**/*.{test,spec}.{ts,tsx}'],
      setupFiles: []
    },
    server: {
      port: DEV_PORT,
      host: '0.0.0.0',
      strictPort: false, // se 3007 estiver ocupada, usa a próxima (3008, 3009...)
      open: false,
      // Durante o desenvolvimento, proxia /api → backend real (Vercel ou outro host),
      // evitando 404 do Vite dev server em http://localhost:3007/api/*.
      proxy: apiBase
        ? {
            '/api': {
              target: apiBase,
              changeOrigin: true,
              secure: apiBase.startsWith('https://'),
            },
          }
        : undefined,
      watch: {
        ignored: ['**/.env*', '**/node_modules/**']
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      warmupAndOpenPlugin()
      // PWA desativado (evita cache/offline conflitantes no Vercel e erro ENOENT do plugin)
      // Para reativar: descomente o import de VitePWA e adicione VitePWA({ ... }) aqui
    ],
    publicDir: 'public',
    optimizeDeps: {
      entries: ['index.html', 'index.tsx', 'App.tsx'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        '@supabase/supabase-js',
        'lucide-react',
        'recharts',
        '@google/genai'
      ]
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  };
});
