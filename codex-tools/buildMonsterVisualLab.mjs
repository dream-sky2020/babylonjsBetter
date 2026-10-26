import { build, loadConfigFromFile } from 'vite';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/monster-visual-build', copyPublicDir: false,
  rollupOptions: { ...config.build?.rollupOptions, input: {
    monsterVisual: config.build.rollupOptions.input.monsterVisualComposableLab,
  } },
};
await build(config);
