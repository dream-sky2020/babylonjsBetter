import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,Color4,MultiMaterial,PBRMaterial,Texture,type AbstractMesh,type Material} from '@babylonjs/core';
import {createModelEntity,clearModelPrefabCache,getModelTextureCacheStats} from '../../../core/model';
import {parseSceneEnvironmentPreset} from '../../../core/scene/sceneEnvironment.parser';
import {createSceneEnvironmentAsync} from '../../../core/scene/createSceneEnvironment';
import manifest from './manifest.json';
const engine=new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);
scene.clearColor=new Color4(.1,.14,.18,1);
const camera=new ArcRotateCamera('camera',-.9,1.05,8,Vector3.Zero(),scene);camera.minZ=.001;camera.maxZ=5000;
new HemisphericLight('light',new Vector3(.3,1,.2),scene).intensity=1.2;
function bounds(meshes:readonly AbstractMesh[]){
 let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate();const point=Vector3.Zero(),world=Vector3.Zero();
 for(const mesh of meshes.filter(m=>m.getTotalVertices())){const matrix=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position')!;for(let i=0;i<positions.length;i+=3){point.set(positions[i],positions[i+1],positions[i+2]);Vector3.TransformCoordinatesToRef(point,matrix,world);low=Vector3.Minimize(low,world);high=Vector3.Maximize(high,world);}}
 return[low,high];
}
function materials(meshes:readonly AbstractMesh[]){return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]).filter(Boolean))] as PBRMaterial[];}
function checkTextures(meshes:readonly AbstractMesh[],entry:typeof manifest.models[number],path=entry.variants[0].texturePath){
 const record=manifest.authors[0].images.find(i=>i.texturePath===path)!;
 const ms=materials(meshes);if(ms.length!==1)throw Error('Expected one source material');
 for(const m of ms){const t=m.albedoTexture as Texture|undefined;
  // Babylon labels source views with their material slot; the cached upload URL still identifies the image.
  const sourceUrl=t?.url?.startsWith('data:model-shared:')?JSON.parse(t.url.slice('data:model-shared:'.length))[0]:t?.url;
  if(!t?.isReady()||!String(sourceUrl).endsWith(path))throw Error(`Missing/wrong variant: ${entry.name}: ${path}; actual=${sourceUrl}; ready=${t?.isReady()}`);
  const size=t.getSize();if(size.width!==record.width||size.height!==record.height)throw Error('Original dimensions changed');
  if(t.samplingMode!==Texture.NEAREST_NEAREST_MIPNEAREST||!(t.gammaSpace||t.getInternalTexture()?._useSRGBBuffer))throw Error(`Pixel sampling or color space changed: ${entry.name}`);
  if(Math.abs(m.roughness!-entry.material.roughness)>1e-6||m.metallic!==0)throw Error('PBR source constants changed');
  if(entry.name==='CarShadow'&&(m.transparencyMode!==PBRMaterial.PBRMATERIAL_ALPHABLEND||Math.abs(m.alpha-.5)>1e-6||!t.hasAlpha||!m.useAlphaFromAlbedoTexture||m.backFaceCulling))throw Error('Shadow alpha/source policy lost');
 }
}
async function verify(){
 const models=[];let isolation=false;
 for(const entry of manifest.models){const options={applyAssetProfile:false,transparencyPolicy:'source' as const},model=await createModelEntity(scene,entry.modelPath,options),meshes=model.meshes.filter(m=>m.getTotalVertices());
  if(meshes.length!==1||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal'))||model.animationGroups.length)throw Error('Geometry/UV/normals/animation mismatch');
  const[low,high]=bounds(meshes);if(Math.abs(low.y)>1e-4||Math.abs((low.x+high.x)/2)>1e-4||Math.abs((low.z+high.z)/2)>1e-4)throw Error(`Not centered/grounded: ${entry.name}`);
  camera.setTarget(low.add(high).scale(.5));camera.radius=high.subtract(low).length()*1.4;
  await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry);
  const peer=entry.name==='Car01'?await createModelEntity(scene,entry.modelPath,options):undefined;
  for(const variant of entry.variants.slice(1)){await model.updateMaterialBindings([{selector:{gltfMaterialIndex:0},textures:{baseColor:{path:variant.texturePath}}}]);await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry,variant.texturePath);
   if(peer){checkTextures(peer.meshes,entry);if(materials(peer.meshes)[0]===materials(meshes)[0])throw Error('Variant material is shared between instances');isolation=true;}}
  const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);if(triangles!==entry.sourceTriangles)throw Error('Triangle count changed');
  models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:1,triangles,animations:0,validatedVariants:entry.variants.map(v=>v.name),allTexturesReady:true,nearestSampling:true,...(entry.name==='CarShadow'?{alphaSourcePreserved:true}:{})});
  peer?.dispose();model.dispose();
 }
 const cache=getModelTextureCacheStats(scene);if(cache.requests!==41||cache.uploads!==41||!isolation)throw Error(`Shared images/material isolation failed: ${JSON.stringify(cache)}`);clearModelPrefabCache(scene);
 return{count:12,colorDisplays:41,cache,allTexturesReady:true,variantMaterialsIndependent:isolation,models};
}
async function overview(){
 scene.lights.slice().forEach(l=>l.dispose());const key='artist-ggbot-model-test',response=await fetch(`/config/sceneEnvironmentPresets/${key}.json`);if(!response.ok)throw Error('Missing preset');
 const declaration=await response.json(),instance=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,key),{shadowQualityPresets:{}});
 const issues:string[]=[],used=new Set<Material>();
 for(const{definition,entity}of instance.models){const meshes=entity.meshes.filter(m=>m.getTotalVertices()),[low,high]=bounds(meshes),d=high.subtract(low),lift=d.y<Math.max(...d.asArray())*.002?.02:0;
  if(Math.abs(low.y-lift)>.001||Math.abs(Math.max(...d.asArray())-2.8)>.001)issues.push(`${definition.id}:bounds`);
  const stand=declaration.objects.find((o:{id:string})=>o.id===`${definition.id}-stand`);if(!stand||Math.abs((low.x+high.x)/2-stand.position[0])>.001||Math.abs((low.z+high.z)/2-stand.position[2])>.001)issues.push(`${definition.id}:centering`);
  const entry=manifest.models.find(m=>m.modelPath===definition.modelPath)!;checkTextures(meshes,entry,definition.materialOverrides?.[0]?.textures?.baseColor?.path);
  for(const m of materials(meshes)){if(used.has(m))issues.push('Material isolation');used.add(m);}
 }
 if(issues.length)throw Error(`Layout/variants: ${issues}`);await scene.whenReadyAsync();
 const[low,high]=bounds(instance.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.25;camera.beta=.75;camera.radius=high.subtract(low).length()*1.15;engine.runRenderLoop(()=>scene.render());
 (window as any).showDetail=async(name:string)=>{const entries=instance.models.filter(m=>manifest.models.find(e=>e.modelPath===m.definition.modelPath)!.name===name);const[low,high]=bounds(entries.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.beta=.9;camera.radius=high.subtract(low).length()*1.25;await new Promise(r=>setTimeout(r,200));};
 await new Promise(r=>setTimeout(r,300));const cache=getModelTextureCacheStats(scene);if(cache.requests!==41||cache.uploads!==41||used.size!==41)throw Error('Overview cache/material count');
 return{presetKey:key,count:41,groups:declaration.transformNodes.length,boundsIssues:issues,independentMaterials:used.size,cache,allTexturesReady:true};
}
let captured:Awaited<ReturnType<typeof createModelEntity>>|undefined;
(window as any).captureModel=async(name:string)=>{captured?.dispose();const entry=manifest.models.find(m=>m.name===name)!;captured=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});const[low,high]=bounds(captured.meshes);camera.setTarget(low.add(high).scale(.5));camera.alpha=-.9;camera.beta=.95;camera.radius=high.subtract(low).length()*1.15;await scene.whenReadyAsync();engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,200));};
(window as any).result=new URLSearchParams(location.search).has('overview')?overview():verify();
