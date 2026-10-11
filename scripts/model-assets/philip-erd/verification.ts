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
  let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate();
  const local=Vector3.Zero(),world=Vector3.Zero();
  for(const mesh of meshes.filter(m=>m.getTotalVertices())){
    const matrix=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position')!;
    // Rotated local bounding boxes include empty corners. Measure rendered vertices
    // so an angled cannon/roof can sit on the stand without hovering or sinking.
    for(let i=0;i<positions.length;i+=3){local.set(positions[i],positions[i+1],positions[i+2]);Vector3.TransformCoordinatesToRef(local,matrix,world);low=Vector3.Minimize(low,world);high=Vector3.Maximize(high,world);}
  }
  return[low,high];
}
function materials(meshes:readonly AbstractMesh[]){return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]))] as Material[];}
function textures(meshes:readonly AbstractMesh[],expected:number){
  const active=new Set();
  for(const material of materials(meshes)){if(!material)throw Error('Material missing');for(const texture of material.getActiveTextures()){if(!texture.isReady())throw Error('Texture not ready');active.add(texture.getInternalTexture());}}
  if(active.size!==expected)throw Error(`Expected ${expected} images, got ${active.size}`);
}
async function verify(){
  const models=[];
  const only=new URLSearchParams(location.search).get('only');
  for(const entry of manifest.models.filter(e=>!only||e.file===only)){
    const model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false});
    const meshes=model.meshes.filter(m=>m.getTotalVertices());
    if(!meshes.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error(`Geometry/UV/normal missing: ${entry.file}`);
    const[low,high]=bounds(meshes),dimension=Math.max(...high.subtract(low).asArray());
    if(![...low.asArray(),...high.asArray()].every(Number.isFinite)||dimension<=0)throw Error('Invalid bounds');
    if(Math.abs(low.y)>dimension*1e-5+.00001||Math.abs(low.x+high.x)>dimension*1e-5+.00001||Math.abs(low.z+high.z)>dimension*1e-5+.00001)throw Error(`Origin not centered/on floor: ${entry.file} ${JSON.stringify({low:low.asArray(),high:high.asArray()})}`);
    if(model.animationGroups.length!==0)throw Error('Unexpected animation');
    camera.setTarget(low.add(high).scale(.5));camera.radius=high.subtract(low).length()*1.4;
    await scene.whenReadyAsync();scene.render();textures(meshes,entry.images.length);
    const mats=materials(meshes) as PBRMaterial[];
    if(entry.category==='Pirate'&&!mats.some(m=>m.transparencyMode===PBRMaterial.PBRMATERIAL_ALPHATEST&&m.albedoTexture?.hasAlpha&&m.useAlphaFromAlbedoTexture))throw Error(`Pirate atlas alpha missing: ${entry.file}`);
    const expectedEmissive=entry.materialSettings.filter((m:any)=>m.emissionStrength>0).length;
    if(expectedEmissive&&!mats.some(m=>m.emissiveTexture&&m.emissiveColor.asArray().some(v=>v>0)))throw Error(`Emission missing: ${entry.file}`);
    models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,triangles:meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),lod:entry.lod,allTexturesReady:true});
    model.dispose();
  }
  const cache=getModelTextureCacheStats(scene);clearModelPrefabCache(scene);
  return{count:models.length,partial:!!only,lodModels:models.filter(m=>m.lod).length,allTexturesReady:true,cache,models};
}
let current:SceneEnvironmentInstance|undefined;
async function loadPreset(key:string){
  current?.dispose();scene.lights.slice().forEach(l=>l.dispose());
  const response=await fetch(`/config/sceneEnvironmentPresets/${key}.json`);if(!response.ok)throw Error('Preset missing');
  const declaration=await response.json();current=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,key),{shadowQualityPresets:{}});
  const used=new Set<Material>(),issues:string[]=[];
  for(const{definition,entity}of current.models){
    const meshes=entity.meshes.filter(m=>m.getTotalVertices()),[low,high]=bounds(meshes),d=high.subtract(low),lift=d.y<Math.max(...d.asArray())*.002?.02:0;
    if(Math.abs(low.y-lift)>.001||Math.abs(Math.max(...d.asArray())-2.8)>.001)issues.push(definition.id);
    const entry=manifest.models.find(e=>e.modelPath===definition.modelPath)!;textures(meshes,entry.images.length);
    for(const m of materials(meshes)){if(used.has(m))issues.push('Material isolation');used.add(m);}
  }
  await scene.whenReadyAsync();if(issues.length)throw Error(`Layout failure: ${issues}`);
  const[low,high]=bounds(current.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.2;camera.beta=.75;camera.radius=high.subtract(low).length()*1.4;
  scene.render();await new Promise(r=>setTimeout(r,250));
  return{presetKey:key,count:current.models.length,groups:declaration.transformNodes.length,independentMaterials:used.size,boundsIssues:issues,cache:getModelTextureCacheStats(scene),allTexturesReady:true};
}
async function overview(){
  camera.minZ=.05;engine.runRenderLoop(()=>scene.render());
  const slugs:Record<string,string>={Cargo:'cargo',Castle:'castle',Halloween:'halloween',Pirate:'pirate',Steampunk:'steampunk',Windows:'windows',ModularBuildings:'modular-buildings',Stones:'stones'};
  (window as any).showTheme=(category:string)=>loadPreset(`artist-philip-erd-${slugs[category]}-model-test`);
  return loadPreset('artist-philip-erd-model-test');
}
(window as any).result=new URLSearchParams(location.search).has('overview')?overview():verify();
