import { build } from 'vite';
import path from 'node:path';
await build({ configFile: false, base: './', publicDir: false,
  resolve: { alias: { '@': path.resolve('.') } },
  build: { outDir: 'node_modules/.cache/lab-config-production',
    rollupOptions: { input: path.resolve('codex-tools/labConfigProductionVerification.html') } },
});
