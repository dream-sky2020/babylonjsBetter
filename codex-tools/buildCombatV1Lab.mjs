import { build } from 'vite';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
await build({ configFile: false, root, base: './', publicDir: false, build: {
  outDir: 'node_modules/.cache/combat-v1-build', emptyOutDir: true,
  rollupOptions: { input: path.join(root, 'labs/standalone/combat-v1-lab/index.html') },
} });
