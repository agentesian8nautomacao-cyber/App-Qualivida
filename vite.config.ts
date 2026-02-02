import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente
  // loadEnv: .env, .env.local (local). process.env: Vercel e variáveis do sistema.
  // Usar process.env só quando o valor for não vazio, senão manter loadEnv.
  const loaded = loadEnv(mode, process.cwd(), '');
  const env: Record<string, string | undefined> = { ...loaded };
  for (const [k, v] of Object.entries(process.env)) {
    if (v != null && String(v).trim() !== '') env[k] = v;
  }
  // No Vercel: GEMINI_API_KEY existe mas VITE_* não. Vite só expõe VITE_* ao cliente.
  // Garantir VITE_GEMINI_API_KEY em process.env para o build expor ao bundle.
  const geminiKey = env.GEMINI_API_KEY ?? env.VITE_GEMINI_API_KEY ?? env.API_KEY ?? '';
  if (geminiKey && !process.env.VITE_GEMINI_API_KEY) {
    process.env.VITE_GEMINI_API_KEY = geminiKey;
  }
  return {
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
      port: 3007,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/.env*', '**/node_modules/**']
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'robots.txt', '1024.png'],
        manifest: {
          name: 'Qualivida Gestão',
          short_name: 'Qualivida',
          description: 'Gestão simples para o dia a dia do condomínio',
          start_url: '/',
          display: 'standalone',
          background_color: '#0c1a13',
          theme_color: '#0b7a4b',
          orientation: 'portrait-primary',
          icons: [
            {
              src: '/1024.png',
              sizes: '1024x1024',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/$/],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot,mp4}'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-api-v3',
                networkTimeoutSeconds: 10
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-v3',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
                }
              }
            },
            {
              urlPattern: /\.(?:js|css|woff|woff2|ttf|eot)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources-v3',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 dias
                }
              }
            }
          ]
        }
      })
    ],
    publicDir: 'public',
    optimizeDeps: {
      entries: ['index.html']
    },
    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  };
});
