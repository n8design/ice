import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/tests/**/*.test.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    }
  }
});
