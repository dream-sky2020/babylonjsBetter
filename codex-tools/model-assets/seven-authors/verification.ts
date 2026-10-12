import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,Color4,MultiMaterial,PBRMaterial,type AbstractMesh,type Material} from '@babylonjs/core';
import {createModelEntity,clearModelPrefabCache,getModelTextureCacheStats} from '../../../core/model';
import {parseSceneEnvironmentPreset} from '../../../core/scene/sceneEnvironment.parser';
import {createSceneEnvironmentAsync} from '../../../core/scene/createSceneEnvironment';
import type {SceneEnvironmentInstance} from '../../../core/scene/sceneEnvironment.types';
import manifest from './manifest.json';
const engine=new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true});
const scene=new Scene(engine);scene.clearColor=new Color4(.1,.14,.18,1);
const camera=new ArcRotateCamera('camera',-.9,1.05,8,Vector3.Zero(),scene);camera.minZ=.001;camera.maxZ=5000;
new HemisphericLight('light',new Vector3(.3,1,.2),scene).intensity=1.2;
function bounds(meshes:readonly AbstractMesh[]){
  let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate();const local=Vector3.Zero(),world=Vector3.Zero();
  for(const mesh of meshes.filter(m=>m.getTotalVertices())){const matrix=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position')!;
    for(let i=0;i<positions.length;i+=3){local.set(positions[i],positions[i+1],positions[i+2]);Vector3.TransformCoordinatesToRef(local,matrix,world);low=Vector3.Minimize(low,world);high=Vector3.Maximize(high,world);}}
  return[low,high];
}
function materials(meshes:readonly AbstractMesh[]){return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]))] as PBRMaterial[];}
function checkTextures(meshes:readonly AbstractMesh[],entry:typeof manifest.models[number]){
  const active=new Set();for(const m of materials(meshes)){if(!m)throw Error('Missing material');for(const t of m.getActiveTextures()){if(!t.isReady())throw Error(`Texture not ready: ${entry.file}: ${t.name}`);active.add(t.getInternalTexture());}}
  if(active.size<entry.images.length)throw Error(`Texture count: ${entry.file}: ${active.size} < ${entry.images.length}`);
  if(entry.name==='ThrowingKnife'&&!materials(meshes).some(m=>m.bumpTexture?.isReady()&&m.metallicTexture?.isReady()&&m.ambientTexture?.isReady()))throw Error('Knife normal/metallic-roughness/AO missing');
}
async function verify(){
  const models=[];for(const entry of manifest.models){const model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false});const meshes=model.meshes.filter(m=>m.getTotalVertices());
    if(!meshes.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error(`Geometry/UV/normal missing: ${entry.file}`);
    if(model.animationGroups.length!==0)throw Error('Unexpected animations');
    const[low,high]=bounds(meshes);if(![...low.asArray(),...high.asArray()].every(Number.isFinite)||high.subtract(low).length()<=0)throw Error(`Invalid bounds: ${entry.file}`);
    if(Math.abs(low.y)>1e-4||Math.abs((low.x+high.x)/2)>1e-4||Math.abs((low.z+high.z)/2)>1e-4)throw Error(`Not centered at ground: ${entry.file}`);
    camera.setTarget(low.add(high).scale(.5));camera.radius=high.subtract(low).length()*1.4;
    await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry);
    models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,triangles:meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),animations:0,allTexturesReady:true});model.dispose();}
  const cache=getModelTextureCacheStats(scene),images=manifest.authors.reduce((n,a)=>n+a.images.length,0);
  if(cache.requests!==images||cache.uploads!==images)throw Error(`Shared cache: expected ${images}, got ${JSON.stringify(cache)}`);
  clearModelPrefabCache(scene);return{count:models.length,cache,allTexturesReady:true,models};
}
let current:SceneEnvironmentInstance|undefined;
async function loadPreset(key:string){
  current?.dispose();scene.lights.slice().forEach(l=>l.dispose());const response=await fetch(`/config/sceneEnvironmentPresets/${key}.json`);if(!response.ok)throw Error('Missing preset');
  const declaration=await response.json();current=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,key),{shadowQualityPresets:{}});
  const issues:string[]=[],used=new Set<Material>();for(const{definition,entity}of current.models){const meshes=entity.meshes.filter(m=>m.getTotalVertices()),[low,high]=bounds(meshes),d=high.subtract(low),lift=d.y<Math.max(...d.asArray())*.002?.02:0;
    if(Math.abs(low.y-lift)>.001||Math.abs(Math.max(...d.asArray())-2.8)>.001)issues.push(`${definition.id}:bounds`);
    const stand=declaration.objects.find((o:{id:string})=>o.id===`${definition.id}-stand`);
    if(!stand||Math.abs((low.x+high.x)/2-stand.position[0])>.001||Math.abs((low.z+high.z)/2-stand.position[2])>.001)issues.push(`${definition.id}:centering`);
    checkTextures(meshes,manifest.models.find(m=>m.modelPath===definition.modelPath)!);
    for(const m of materials(meshes)){if(used.has(m))issues.push('Material isolation');used.add(m);}}
  await scene.whenReadyAsync();if(issues.length)throw Error(`Layout failure: ${issues}`);
  const[low,high]=bounds(current.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.25;camera.beta=.85;camera.radius=Math.max(10,high.subtract(low).length()*1.2);engine.runRenderLoop(()=>scene.render());
  await new Promise(r=>setTimeout(r,300));return{presetKey:key,count:current.models.length,groups:declaration.transformNodes.length,boundsIssues:issues,independentMaterials:used.size,cache:getModelTextureCacheStats(scene),allTexturesReady:true};
}
(window as any).loadPreset=loadPreset;(window as any).getCache=()=>getModelTextureCacheStats(scene);
(window as any).result=new URLSearchParams(location.search).has('overview')?Promise.resolve({}):verify();

