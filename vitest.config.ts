import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'api/**/*.test.ts',
      'sentinela/**/*.test.ts',
      'services/**/*.test.ts',
      'utils/**/*.test.ts'
    ],
    exclude: [
      '**/node_modules/**',
      '**/node_modules.bak/**',
      '**/node_modules.OLD.*/**',
      '**/dist/**'
    ]
  }
});
