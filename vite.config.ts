import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
      plugins: [react()],
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
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
