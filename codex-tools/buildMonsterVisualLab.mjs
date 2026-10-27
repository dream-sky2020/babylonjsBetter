import { build, loadConfigFromFile } from 'vite';
import path from 'node:path';
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' });
if (!loaded) throw new Error('Missing Vite config');
const config = loaded.config;
config.configFile = false;
config.build = { ...config.build, outDir: 'node_modules/.cache/monster-visual-build', copyPublicDir: false,
  rollupOptions: { ...config.build?.rollupOptions, input: Object.fromEntries([
    ['monsterVisual', config.build.rollupOptions.input.monsterVisualComposableLab],
    ['monsterDissolve', config.build.rollupOptions.input.monsterDissolveComposableLab],
    ...['monster-3d-visual-lab', 'monster-dissolve-effect-lab', 'monster-formation-lab', 'monster-battlefield-stripe-rules-lab',
      'monster-movement-lab', 'monster-attack-lab', 'monster-hit-feedback-lab', 'monster-knockback-lab',
      'monster-special-status-position-lab', 'monster-exclamation-position-lab',
      'special-status-visual-lab', 'exclamation-mark-lab'].map(name => {
      const entry = Object.values(config.build.rollupOptions.input).find(file => path.basename(path.dirname(file)) === name);
      if (!entry) throw new Error(`Missing monster Lab entry: ${name}`);
      return [name, entry];
    }),
  ]) },
};
await build(config);
