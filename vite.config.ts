import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const DEV_PORT = 3008;

/** Abre o navegador assim que o servidor estiver listening. */
function openBrowserPlugin(): import('vite').Plugin {
  return {
    name: 'open-browser',
    apply: 'serve' as const,
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        const port = typeof addr === 'object' && addr && 'port' in addr ? addr.port : DEV_PORT;
        const url = `http://localhost:${port}/`;
        import('node:child_process').then(({ exec }) => {
          const cmd = process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
          exec(cmd, () => {});
        }).catch(() => {});
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
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@google/genai')) return 'vendor-genai';
              if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
              if (id.includes('@supabase/supabase-js')) return 'vendor-supabase';
              if (id.includes('recharts')) return 'vendor-recharts';
              if (id.includes('lucide-react')) return 'vendor-lucide';
              if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('jsqr')) return 'vendor-assets';
              if (id.includes('dexie')) return 'vendor-dexie';
              return 'vendor';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      chunkSizeWarningLimit: 600,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['**/*.{test,spec}.{ts,tsx}'],
      setupFiles: []
    },
    server: {
      port: 3008,
      host: '0.0.0.0',
      strictPort: true,
      open: false,
      // HMR na mesma porta do servidor (3008) para evitar WebSocket em porta errada
      hmr: {
        port: 3008,
        host: 'localhost',
        protocol: 'ws',
      },
      // Sem warmup: servidor sobe em segundos (warmup com App.tsx pesado atrasava 3+ s)
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
        ignored: [
          '**/.env*',
          '**/node_modules/**',
          '**/node_modules.bak/**',
          '**/node_modules.OLD.*/**',
          '**/.git/**',
          '**/dist/**',
        ],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      openBrowserPlugin(),
      VitePWA({
        injectRegister: 'inline',
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallback: '/index.html'
        },
        devOptions: { enabled: false }
      })
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
        'dexie',
        'jspdf',
        'jsqr',
        '@google/genai',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  };
});
