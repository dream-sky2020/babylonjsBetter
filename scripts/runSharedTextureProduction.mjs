import { spawnElectron } from './spawnElectron.mjs';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawnElectron(['scripts/shared-textures/production.cjs'],{env,windowsHide:true,stdio:'inherit'});
child.on('exit',code=>{process.exitCode=code??1;});child.on('error',error=>{console.error(error);process.exitCode=1;});
