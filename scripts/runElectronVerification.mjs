import { spawnElectron } from './spawnElectron.mjs';

const args = process.argv.slice(2);
if (!args.length) throw new Error('Provide an Electron verification entry path.');
const child = spawnElectron(args, { stdio: 'inherit' });
child.once('close', code => { process.exitCode = code ?? 1; });
child.once('error', error => { console.error(error); process.exitCode = 1; });
