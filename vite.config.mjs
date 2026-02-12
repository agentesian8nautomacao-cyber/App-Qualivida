/* Config em ESM: defineConfig do vite + plugins. */
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
    port: 3007,
    host: '0.0.0.0',
    watch: {
      ignored: ['**/.env*', '**/node_modules/**']
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: true,
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
          { src: '/1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/$/, /\.mp4$/i],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          { urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i, handler: 'NetworkFirst', options: { cacheName: 'supabase-api-v3', networkTimeoutSeconds: 10 } },
          { urlPattern: /\.(?:mp4|m4v|webm)$/i, handler: 'NetworkFirst', options: { cacheName: 'video-v1', networkTimeoutSeconds: 5, expiration: { maxEntries: 5, maxAgeSeconds: 86400 } } },
          { urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/, handler: 'CacheFirst', options: { cacheName: 'images-v3', expiration: { maxEntries: 100, maxAgeSeconds: 2592000 } } },
          { urlPattern: /\.(?:js|css|woff|woff2|ttf|eot)$/, handler: 'StaleWhileRevalidate', options: { cacheName: 'static-resources-v3', expiration: { maxEntries: 200, maxAgeSeconds: 604800 } } }
        ]
      }
    })
  ],
  publicDir: 'public',
  optimizeDeps: {
    entries: ['index.html']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  }
});
