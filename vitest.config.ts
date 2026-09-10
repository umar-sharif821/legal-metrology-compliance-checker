import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      // Demo-only (docs/DEMO_PLAN.md). mobile/ is not an npm workspace, but its
      // extraction and evaluator modules are plain TypeScript with no React Native
      // import, so they run here and are covered by the root `npm test` gate.
      // Removed when the demo is retired and T-1.7 lands the real evaluator.
      'mobile/src/**/*.test.ts',
      // Demo-only too. The dashboard's OCR line-repair is pure and belongs under the
      // same gate as the engine it feeds — a regression there produces a confidently
      // wrong declaration, which is the failure this project can least afford.
      'dashboard/src/**/*.test.ts',
    ],
    environment: 'node',
    reporters: ['default'],
  },
});
