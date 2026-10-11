import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
// Isolate the working directory before Electron itself starts, rather than
// waiting for its application entry point to run.
export function spawnElectron(args, options = {}) {
  const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'babylon-electron-'));
  const cleanup = () => {
    if (path.dirname(path.resolve(workDirectory)) !== path.resolve(os.tmpdir()) ||
        !path.basename(workDirectory).startsWith('babylon-electron-')) return;
    try { fs.rmSync(workDirectory, { recursive: true, force: true, maxRetries: 3 }); }
    catch (error) { console.warn(`Could not remove Electron temporary directory: ${error.message}`); }
  };
  const env = { ...process.env, ...options.env, BABYLON_ELECTRON_WORKDIR: workDirectory };
  delete env.ELECTRON_RUN_AS_NODE;
  let child;
  try {
    child = spawn(electron, [path.resolve(repositoryRoot, args[0]), ...args.slice(1)], {
      windowsHide: true, ...options, cwd: workDirectory, env,
    });
  } catch (error) { cleanup(); throw error; }
  child.once('close', cleanup);
  child.once('error', cleanup);
  return child;
}
