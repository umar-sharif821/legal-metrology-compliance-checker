import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The rule pack is read from its single source of truth rather than copied in.
// Duplicating clause letters into the dashboard would put statutory facts in two
// places, which is exactly what P6 exists to prevent.
//
// DEMO WIRING: it points at the demo pack under `mobile/`, which is throwaway
// scaffolding (docs/DEMO_PLAN.md). `T-4.4` repoints this alias at
// `rulepack/lmpc-2011.json` and nothing else in `src/` changes — every consumer
// goes through `src/lib/rulepack.ts`.
const rulepack = fileURLToPath(
  new URL('../mobile/src/rulepack/demo-lmpc-v0.json', import.meta.url),
);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@rulepack': rulepack,
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The pack lives outside this project's root.
    fs: { allow: [repoRoot] },
    proxy: {
      // Backend does not exist yet (Sprint 3). When it does, this forwards to it;
      // until then every call fails fast and `src/lib/api.ts` falls back to the
      // sample corpus, which is why the UI is demo-ready with no server running.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
