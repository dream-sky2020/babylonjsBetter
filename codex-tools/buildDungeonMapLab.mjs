import { build, loadConfigFromFile } from 'vite';
import path from 'node:path';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite configuration');
const config = loaded.config;
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/dungeon-map-workbench-build', copyPublicDir: false,
  rollupOptions: { ...config.build?.rollupOptions, input: path.resolve('labs/standalone/dungeon-map-canvas-lab/index.html') } };
await build(config);
