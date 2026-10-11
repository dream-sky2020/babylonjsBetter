import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4, MultiMaterial, type AbstractMesh, type Material } from '@babylonjs/core';
import { createModelEntity, clearModelPrefabCache, getModelTextureCacheStats } from '../../../core/model';
import manifest from './manifest.json';
import { parseSceneEnvironmentPreset } from '../../../core/scene/sceneEnvironment.parser';
import { createSceneEnvironmentAsync } from '../../../core/scene/createSceneEnvironment';
const engine = new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true});
const scene = new Scene(engine); scene.clearColor = new Color4(.1,.14,.18,1);
const camera = new ArcRotateCamera('camera',-.9,1.05,8,Vector3.Zero(),scene);
camera.minZ = .001; camera.maxZ = 3000;
new HemisphericLight('light',new Vector3(.3,1,.2),scene).intensity = 1.2;
function bounds(meshes: readonly AbstractMesh[]) {
  let low = new Vector3(Infinity,Infinity,Infinity), high = low.negate();
  for(const mesh of meshes.filter(m=>m.getTotalVertices())){
    mesh.computeWorldMatrix(true);const b=mesh.getBoundingInfo().boundingBox;
    low=Vector3.Minimize(low,b.minimumWorld);high=Vector3.Maximize(high,b.maximumWorld);
  }
  return [low,high];
}
function materials(meshes: readonly AbstractMesh[]) {
  return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]))] as Material[];
}
function checkTextures(meshes: readonly AbstractMesh[],expected: number) {
  const images = new Set();
  for(const material of materials(meshes)){
    if(!material)throw Error('Material missing');
    for(const texture of material.getActiveTextures()){
      if(!texture.isReady())throw Error(`Texture not ready: ${texture.name}`);
      // glTF gives each material's texture wrapper a different name even for one shared image.
      images.add(texture.getInternalTexture());
    }
  }
  if(images.size!==expected)throw Error(`Expected ${expected} textures, got ${images.size}`);
}
async function verify() {
  const models = [];
  for(const entry of manifest.models){
    const model = await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false});
    const meshes = model.meshes.filter(m=>m.getTotalVertices());
    if(!meshes.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error(`Geometry/UV/normal missing: ${entry.name}`);
    const [low,high]=bounds(meshes);
    if(![...low.asArray(),...high.asArray()].every(Number.isFinite)||high.subtract(low).length()<=0)throw Error(`Invalid bounds: ${entry.name}`);
    if(model.animationGroups.length!==entry.animations)throw Error('Animation count mismatch');
    camera.setTarget(low.add(high).scale(.5));camera.radius=high.subtract(low).length()*1.4;
    await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry.images.length);
    models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,triangles:meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),animations:model.animationGroups.length,allTexturesReady:true});
    model.dispose();
  }
  const cache=getModelTextureCacheStats(scene);clearModelPrefabCache(scene);
  return{count:models.length,cache,allTexturesReady:true,models};
}
async function overview() {
  camera.minZ=.05;
  const response=await fetch('/config/sceneEnvironmentPresets/artist-ciprient-model-test.json');
  if(!response.ok)throw Error('Preset missing');
  const declaration=await response.json();scene.lights.slice().forEach(l=>l.dispose());
  const instance=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,declaration.presetKey),{shadowQualityPresets:{}});
  const issues:string[]=[],used=new Set<Material>();
  for(const {definition,entity} of instance.models){
    const meshes=entity.meshes.filter(m=>m.getTotalVertices()),[low,high]=bounds(meshes);
    if(Math.abs(low.y)>.001||Math.abs(Math.max(...high.subtract(low).asArray())-2.8)>.001)issues.push(definition.id);
    const entry=manifest.models.find(m=>m.modelPath===definition.modelPath)!;
    checkTextures(meshes,entry.images.length);
    for(const material of materials(meshes)){if(used.has(material))issues.push(`${definition.id}:material-isolation`);used.add(material);}
  }
  await scene.whenReadyAsync();if(issues.length)throw Error(`Layout or material failure: ${issues}`);
  camera.setTarget(new Vector3(0,.6,0));camera.alpha=-Math.PI/2;camera.beta=.75;camera.radius=30;
  engine.runRenderLoop(()=>scene.render());
  (window as any).showDetail=async(group:string)=>{
    const categories=group==='Vehicles'?['Ambulance','Cars']:[group];
    const entries=instance.models.filter(m=>categories.includes(manifest.models.find(e=>e.modelPath===m.definition.modelPath)!.category));
    const[low,high]=bounds(entries.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));
    camera.alpha=-Math.PI/2-.35;camera.beta=1.05;camera.radius=high.subtract(low).length()*1.2;
    await new Promise(resolve=>setTimeout(resolve,250));
  };
  await new Promise(resolve=>setTimeout(resolve,300));
  return{count:instance.models.length,groups:declaration.transformNodes.length,boundsIssues:issues,independentMaterials:used.size,cache:getModelTextureCacheStats(scene),allTexturesReady:true};
}
(window as any).result=new URLSearchParams(location.search).has('overview')?overview():verify();
