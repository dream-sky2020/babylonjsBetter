import { build, loadConfigFromFile } from 'vite';
import path from 'node:path';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/scene-editor-build', copyPublicDir: false,
  rollupOptions: { ...config.build?.rollupOptions, input: Object.fromEntries(['model-shake-lab', 'model-asset-normalization-lab', 'animation-workbench-lab', 'scene-environment-lab'].map(name => [name, path.resolve(`tools/${name}/index.html`)])) },
};
await build(config);
