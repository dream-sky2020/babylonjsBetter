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
    for(let i=0;i<positions.length;i+=3){local.set(positions[i],positions[i+1],positions[i+2]);Vector3.TransformCoordinatesToRef(local,matrix,world);low=Vector3.Minimize(low,world);high=Vector3.Maximize(high,world);}
  }return[low,high];
}
function materials(meshes:readonly AbstractMesh[]){return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]))] as PBRMaterial[];}
function checkTextures(meshes:readonly AbstractMesh[],minimum:number){
  const active=new Set();
  for(const m of materials(meshes)){if(!m)throw Error('Missing material');for(const t of m.getActiveTextures()){if(!t.isReady())throw Error(`Texture not ready: ${t.name}`);active.add(t.getInternalTexture());}}
  if(active.size<minimum)throw Error(`Expected at least ${minimum} images, got ${active.size}`);
}
async function verify(){
  const models=[];
  for(const entry of manifest.models){
    const model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false});
    const meshes=model.meshes.filter(m=>m.getTotalVertices());
    if(!meshes.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error(`Geometry/UV/normal missing: ${entry.file}`);
    const[low,high]=bounds(meshes);if(![...low.asArray(),...high.asArray()].every(Number.isFinite)||high.subtract(low).length()<=0)throw Error(`Invalid bounds: ${entry.file}`);
    if(model.animationGroups.length!==entry.animations)throw Error(`Animation mismatch: ${entry.file}`);
    if(entry.skinnedMeshNodes&&!meshes.some(m=>m.skeleton))throw Error('Bound skeleton lost');
    camera.setTarget(low.add(high).scale(.5));camera.radius=high.subtract(low).length()*1.4;
    await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry.images.length);
    if('materialRepairs'in entry&&!materials(meshes).some(m=>m.transparencyMode===PBRMaterial.PBRMATERIAL_ALPHATEST&&m.albedoTexture?.hasAlpha&&m.useAlphaFromAlbedoTexture))throw Error('Market plant cutout missing');
    if(entry.author==='artist_xeniithh'&&!materials(meshes).some(m=>m.transparencyMode===PBRMaterial.PBRMATERIAL_ALPHATEST&&m.albedoTexture?.hasAlpha&&m.useAlphaFromAlbedoTexture))throw Error('Leaf transparency missing');
    const skinCount=new Set(meshes.filter(m=>m.skeleton).map(m=>m.skeleton)).size;
    for(const group of model.animationGroups){group.start(true);group.goToFrame((group.from+group.to)/2);scene.render();if(!group.isStarted||!group.targetedAnimations.length)throw Error('Animation failed to start');group.stop();group.reset();}
    for(const variant of entry.variants){
      await model.updateMaterialBindings([{selector:{gltfMaterialIndex:variant.materialIndex},textures:{baseColor:{path:variant.texturePath}}}]);
      await scene.whenReadyAsync();scene.render();if(!materials(meshes).some(m=>m.albedoTexture?.isReady()&&m.albedoTexture.name.endsWith(variant.texturePath)))throw Error('Variant texture missing');
    }
    models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,
      triangles:meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),animations:model.animationGroups.length,animationNames:model.animationGroups.map(g=>g.name),skins:skinCount,variants:entry.variants.length,allTexturesReady:true});
    model.dispose();
  }
  const cache=getModelTextureCacheStats(scene);clearModelPrefabCache(scene);
  return{count:models.length,allTexturesReady:true,cache,models};
}
let current:SceneEnvironmentInstance|undefined;
async function loadAuthor(author:string){
  current?.dispose();scene.lights.slice().forEach(l=>l.dispose());
  const key=author.startsWith('artist-')?author:`artist-${author}-model-test`,response=await fetch(`/config/sceneEnvironmentPresets/${key}.json`);if(!response.ok)throw Error('Preset missing');
  const declaration=await response.json();current=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,key),{shadowQualityPresets:{}});
  const used=new Set<Material>(),issues:string[]=[];
  for(const{definition,entity}of current.models){
    const meshes=entity.meshes.filter(m=>m.getTotalVertices()),[low,high]=bounds(meshes),d=high.subtract(low),lift=d.y<Math.max(...d.asArray())*.002?.02:0;
    if(Math.abs(low.y-lift)>.001||Math.abs(Math.max(...d.asArray())-2.8)>.001)issues.push(`${definition.id}:${JSON.stringify({low:low.asArray(),high:high.asArray(),max:Math.max(...d.asArray())})}`);
    const entry=manifest.models.find(e=>e.modelPath===definition.modelPath)!;checkTextures(meshes,entry.images.length);
    if('materialRepairs'in entry&&!materials(meshes).some(m=>m.transparencyMode===PBRMaterial.PBRMATERIAL_ALPHATEST&&m.albedoTexture?.hasAlpha&&m.useAlphaFromAlbedoTexture))issues.push('Market plant cutout missing');
    const alt=definition.materialOverrides?.[0]?.textures?.baseColor?.path;
    if(alt&&!materials(meshes).some(m=>m.albedoTexture?.name.endsWith(alt)))issues.push('Wrong variant');
    for(const m of materials(meshes)){if(used.has(m))issues.push('Material isolation');used.add(m);}
  }
  await scene.whenReadyAsync();if(issues.length)throw Error(`Layout failure: ${issues}`);
  const[low,high]=bounds(current.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.3;camera.beta=.85;camera.radius=high.subtract(low).length()*1.4;
  scene.render();await new Promise(r=>setTimeout(r,250));
  return{presetKey:key,count:current.models.length,groups:declaration.transformNodes.length,independentMaterials:used.size,boundsIssues:issues,cache:getModelTextureCacheStats(scene),allTexturesReady:true};
}
async function overview(){
  camera.minZ=.01;engine.runRenderLoop(()=>scene.render());
  (window as any).showAuthor=loadAuthor;
  (window as any).showDetail=async(category:string)=>{
    const models=current!.models.filter(m=>manifest.models.find(e=>e.modelPath===m.definition.modelPath)!.category===category);
    const[low,high]=bounds(models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.beta=1.05;camera.radius=high.subtract(low).length()*1.2;
    await new Promise(r=>setTimeout(r,250));
  };
  return loadAuthor('xeniithh');
}
(window as any).result=new URLSearchParams(location.search).has('overview')?overview():verify();
