import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
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
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
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
            },
            {
              src: '/play_store_512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'NetworkOnly',
              options: {
                cacheName: 'supabase-api',
                networkTimeoutSeconds: 10
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
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
                cacheName: 'static-resources',
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
      disabled: false,
      entries: ['index.html']
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.')
      }
    }
  };
});
