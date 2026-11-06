import { build, loadConfigFromFile } from 'vite';
import path from 'node:path';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/dungeon-interaction-build', copyPublicDir: false,
  rollupOptions: { ...config.build?.rollupOptions, input: path.resolve('labs/composable/dungeon-interaction-lab/index.html') } };
await build(config);
