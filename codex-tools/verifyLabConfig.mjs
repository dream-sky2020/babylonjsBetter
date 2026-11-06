import { createServer, loadConfigFromFile } from 'vite';
import path from 'node:path';
import { spawnElectron } from './spawnElectron.mjs';
const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' });
if (!loaded) throw new Error('Missing Vite config');
const server = await createServer({ ...loaded.config, configFile: false,
  cacheDir: 'node_modules/.cache/vite-lab-config-verification',
  server: { ...loaded.config.server, host: '127.0.0.1', port: 1185, strictPort: true, open: false, hmr: true },
});
try {
  server.middlewares.use('/__verify-lab-config-file-change', (_request, response) => {
    // Exercise the actual watcher/HMR path without writing a formal configuration.
    server.watcher.emit('change', path.resolve('config/labs/dungeon-player-movement-lab.json'));
    response.statusCode = 200; response.end('ok');
  });
  await server.listen();
  const child = spawnElectron(['codex-tools/verifyLabConfig.cjs'], { stdio: 'inherit',
    env: { LAB_SETTINGS_ORIGIN: 'http://127.0.0.1:1185' } });
  process.exitCode = await new Promise((resolve, reject) => { child.once('close', code => resolve(code ?? 1)); child.once('error', reject); });
} finally { await server.close(); }
