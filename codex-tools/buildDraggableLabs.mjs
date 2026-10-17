import { build, loadConfigFromFile } from 'vite';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
const input = Object.fromEntries(Object.entries(config.build.rollupOptions.input).filter(([, filename]) => /labs[\\/](?:draggable|standalone)[\\/](?:press-turn|equipment|clash)-lab[\\/]/.test(filename)));
if (Object.keys(input).length !== 18) throw new Error('Expected nine draggable entries and nine compatibility redirects');
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/draggable-labs-build', copyPublicDir: false, rollupOptions: { ...config.build.rollupOptions, input } };
await build(config);
