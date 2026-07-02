import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,          // permite describe/it/expect sem imports
    environment: 'node',
    testTimeout: 15000,     // 15s por teste (inclui operações no BD)
    hookTimeout: 15000,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/**', 'src/infra/repositories/**'],
      exclude: ['src/test-*.ts'],
    },
  },
});
