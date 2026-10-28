import { build, loadConfigFromFile } from 'vite';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/dungeon-ui-overlay-build', copyPublicDir: false,
  rollupOptions: { ...config.build?.rollupOptions, input: { dungeonUiOverlay: config.build.rollupOptions.input.dungeonUiOverlayLab } } };
await build(config);
