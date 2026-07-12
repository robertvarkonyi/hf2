import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A futásidejű tesztek (*.test.ts) alapból futnak; a type tesztek (*.test-d.ts)
    // a `vitest typecheck` móddal, tsc-alapú típusellenőrzéssel.
    typecheck: {
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
  },
});
