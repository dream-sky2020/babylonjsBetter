import { spawnElectron } from './spawnElectron.mjs';
import { existsSync, readFileSync, rmSync } from 'node:fs';
const report = 'node_modules/.cache/deformation-webgl.json';
if (existsSync(report)) rmSync(report);
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const child = spawnElectron(['codex-tools/deformationWebGL.cjs'], { windowsHide: true, env, stdio: 'inherit' });
child.on('exit', code => { console.log(existsSync(report) ? readFileSync(report, 'utf8') : `Electron exited ${code} before producing a report`); process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error); process.exitCode = 1; });
