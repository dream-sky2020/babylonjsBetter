import { build, loadConfigFromFile } from 'vite';
import { readdirSync } from 'node:fs';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
const labs = readdirSync(new URL('../labs/draggable/', import.meta.url));
const input = Object.fromEntries(Object.entries(config.build.rollupOptions.input).filter(([, filename]) => {
  const match = filename.match(/labs[\\/](?:draggable|standalone)[\\/]([^\\/]+)[\\/]/);
  return match && labs.includes(match[1]);
}));
if (Object.keys(input).length !== labs.length * 6) throw new Error('Expected three entries and three compatibility redirects for each draggable Lab');
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/draggable-labs-build', copyPublicDir: false, rollupOptions: { ...config.build.rollupOptions, input } };
await build(config);
