import {createServer,build} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import { spawnElectron } from './spawnElectron.mjs';
import {decode,encode,embed} from './sharedTextureMigration.mjs';
const author='artist_valsekamerplant';
const stage=path.resolve('.asset-migration/valsekamerplant/author-layout-v1/sample');
const fullStage=path.resolve('.asset-migration/valsekamerplant/author-layout-v1/candidate');
// A fresh checkout can test the migrated assets without needing the local original backup.
if(!await fs.access(path.join(fullStage,'manifest.json')).then(()=>true,()=>false)){
  const report=JSON.parse(await fs.readFile(`public/resources/Model/SharedTextures/${author}/valsekamerplant-manifest.json`));
  await fs.mkdir(fullStage,{recursive:true});await fs.cp('public/resources/Model/GLB/artist_valsekamerplant',path.join(fullStage,'models'),{recursive:true});
  await fs.cp(`public/resources/Model/SharedTextures/${author}`,path.join(fullStage,'textures'),{recursive:true});await fs.writeFile(path.join(fullStage,'manifest.json'),JSON.stringify(report));
}
if(!await fs.access(path.join(stage,'manifest.json')).then(()=>true,()=>false)){
  const report=JSON.parse(await fs.readFile(path.join(fullStage,'manifest.json')));const selected=report.models.filter(m=>/medieval/i.test(m.path)).slice(0,2);
  for(const m of selected){const target=path.join(stage,'models',m.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(fullStage,'models',m.path),target);}
  await fs.mkdir(path.join(stage,'textures'),{recursive:true});for(const image of new Set(selected.flatMap(m=>m.images)))await fs.copyFile(path.join(fullStage,'textures',image),path.join(stage,'textures',image));
  await fs.writeFile(path.join(stage,'manifest.json'),JSON.stringify({...report,models:selected,modelCount:selected.length}));
}
const manifest=JSON.parse(await fs.readFile(path.join(stage,'manifest.json')));
const out=path.resolve('.asset-migration/shared-texture-build');
const fullManifest=JSON.parse(await fs.readFile(path.join(fullStage,'manifest.json')));
const config={configFile:false,cacheDir:'.asset-migration/vite-texture-cache',base:'./',resolve:{alias:{'@':process.cwd()}},build:{outDir:out,emptyOutDir:true,copyPublicDir:false,rollupOptions:{input:path.resolve('codex-tools/shared-textures/index.html')}}};
const routes=new Map();
manifest.models.forEach((m,i)=>routes.set(`/resources/__shared-test__/${i}.glb`,path.join(stage,'models',m.path)));
routes.set('/resources/__shared-test__/embedded.glb',path.resolve('public/resources/Model/GLB/artist_valsekamerplant',manifest.models[0].path));
const originalBackup=path.resolve('.asset-migration/valsekamerplant/backup',manifest.models[0].path);
if(await fs.access(originalBackup).then(()=>true,()=>false))routes.set('/resources/__shared-test__/embedded.glb',originalBackup);
else {
  const bytes=await fs.readFile(path.join(stage,'models',manifest.models[0].path));const images=new Map(await Promise.all(manifest.models[0].images.map(async name=>[name,await fs.readFile(path.join(stage,'textures',name))])));
  await fs.writeFile(path.join(stage,'embedded.glb'),embed(bytes,images));routes.set('/resources/__shared-test__/embedded.glb',path.join(stage,'embedded.glb'));
}
for(const image of await fs.readdir(path.join(stage,'textures'))) routes.set(`/resources/Model/SharedTextures/${author}/${image}`,path.join(stage,'textures',image));
const alternative=(await fs.readdir(path.join(fullStage,'textures'))).find(name=>name.endsWith('.png') && name!==manifest.models[0].images[0]);
routes.set('/resources/__shared-test__/alternative.png',path.join(fullStage,'textures',alternative));
const animated=fullManifest.models.find(m=>m.path.endsWith('beans_barrel_fillter.glb'));
routes.set('/resources/__shared-test__/animated.glb',path.join(fullStage,'models',animated.path));
for(const name of animated.images)routes.set(`/resources/Model/SharedTextures/${author}/${name}`,path.join(fullStage,'textures',name));
const standard=decode(await fs.readFile(path.join(stage,'models',manifest.models[0].path)));
for(const mode of ['MASK','BLEND']){
  const alpha=decode(await fs.readFile(path.join(stage,'models',manifest.models[0].path)));
  for(const material of alpha.json.materials){material.alphaMode=mode;if(mode==='MASK')material.alphaCutoff=.33;}
  const name=`alpha-${mode.toLowerCase()}.glb`,file=path.join(stage,name);
  await fs.writeFile(file,encode(alpha.json,alpha.bin));routes.set(`/resources/__shared-test__/${name}`,file);
}
for(const image of standard.json.images)image.uri='textures/'+image.uri.split('/').pop();
await fs.writeFile(path.join(stage,'standard.glb'),encode(standard.json,standard.bin));
routes.set('/resources/__shared-test__/standard.glb',path.join(stage,'standard.glb'));
for(const name of manifest.models[0].images)routes.set(`/resources/__shared-test__/textures/${name}`,path.join(stage,'textures',name));
if(process.argv.includes('--all')){
  for(const [i,m] of fullManifest.models.entries())routes.set(`/resources/__shared-test__/all/${i}.glb`,path.join(fullStage,'models',m.path));
  for(const name of (await fs.readdir(path.join(fullStage,'textures'))).filter(n=>/\.(png|jpg)$/.test(n)))routes.set(`/resources/Model/SharedTextures/${author}/${name}`,path.join(fullStage,'textures',name));
}
const fixture=Buffer.from(JSON.stringify({image:`${author}/${manifest.models[0].images[0]}`,all:process.argv.includes('--all')?fullManifest.modelCount:0}));
async function browser(url){const env={...process.env,MODEL_TEXTURE_TEST_URL:url};delete env.ELECTRON_RUN_AS_NODE;
  const code=await new Promise((resolve,reject)=>{const child=spawnElectron(['codex-tools/shared-textures/browser.cjs'],{env,windowsHide:true,stdio:'inherit'});child.on('exit',resolve);child.on('error',reject);});if(code!==0)throw new Error(`Browser exited ${code}`);}
const server=await createServer({...config,server:{host:'127.0.0.1',port:0,open:false},plugins:[{name:'fixtures',configureServer(server){server.middlewares.use(async(req,res,next)=>{const url=decodeURI(req.url.split('?')[0]);if(url==='/resources/__shared-test__/fixture.json'){res.setHeader('Content-Type','application/json');res.end(fixture);}else if(routes.has(url)){res.end(await fs.readFile(routes.get(url)));}else next();});}}]});
try{await server.listen();await browser(`http://127.0.0.1:${server.httpServer.address().port}/codex-tools/shared-textures/index.html`);}finally{await server.close();}
process.env.NODE_ENV='production';
await build(config);
for(const [url,file] of routes){const target=path.join(out,url);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);}
await fs.writeFile(path.join(out,'resources/__shared-test__/fixture.json'),fixture);
await browser(pathToFileURL(path.join(out,'codex-tools/shared-textures/index.html')).href);
console.log('Shared texture HTTP + production file:// verification passed.');
