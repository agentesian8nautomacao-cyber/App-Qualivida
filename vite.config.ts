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
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
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
