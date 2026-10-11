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
function checkTextures(meshes:readonly AbstractMesh[],entry:typeof manifest.models[number]){
 const record=manifest.authors[0].images.find(i=>i.file===entry.images[0])!,ms=materials(meshes);if(ms.length!==1)throw Error('Expected one source material');
 for(const m of ms){const t=m.albedoTexture as Texture|undefined,sourceUrl=t?.url?.startsWith('data:model-shared:')?JSON.parse(t.url.slice('data:model-shared:'.length))[0]:t?.url;
  if(!t?.isReady()||!String(sourceUrl).endsWith(record.texturePath))throw Error(`Missing/wrong image: ${entry.name}; actual=${sourceUrl}`);
  const size=t.getSize();if(size.width!==record.width||size.height!==record.height)throw Error('Original image dimensions changed');
  if(t.samplingMode!==Texture.NEAREST_SAMPLINGMODE||!t.noMipmap||t.wrapU!==Texture.CLAMP_ADDRESSMODE||t.wrapV!==Texture.CLAMP_ADDRESSMODE||!(t.gammaSpace||t.getInternalTexture()?._useSRGBBuffer))throw Error(`Source sampling/color space changed: ${entry.name}; sampling=${t.samplingMode},noMipmap=${t.noMipmap}`);
  if(m.roughness!==1||m.metallic!==0||m.alphaCutOff!==.05||m.transparencyMode!==PBRMaterial.PBRMATERIAL_ALPHATEST||!t.hasAlpha||!m.useAlphaFromAlbedoTexture||m.backFaceCulling)throw Error(`Source PBR/mask policy changed: ${entry.name}`);
 }
}
async function verify(){
 const models=[];let isolation=false;
 for(const entry of manifest.models){const options={applyAssetProfile:false,transparencyPolicy:'source' as const},model=await createModelEntity(scene,entry.modelPath,options),meshes=model.meshes.filter(m=>m.getTotalVertices());
  if(meshes.length!==entry.meshCount||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal'))||model.animationGroups.length)throw Error('Geometry/UV/normals/animation mismatch');
  const[low,high]=bounds(meshes);if(Math.abs(low.y)>1e-4||Math.abs((low.x+high.x)/2)>1e-4||Math.abs((low.z+high.z)/2)>1e-4)throw Error(`Not centered/grounded: ${entry.name}`);
  await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry);
  if(entry.name==='Bookshelf01'){const peer=await createModelEntity(scene,entry.modelPath,options),a=materials(meshes)[0],b=materials(peer.meshes)[0];if(a===b)throw Error('Instance materials not isolated');a.albedoColor.r=.25;if(b.albedoColor.r!==1)throw Error('Peer material changed');isolation=true;peer.dispose();}
  const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);if(triangles!==entry.sourceTriangles)throw Error('Triangle count changed');
  models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,triangles,animations:0,allTexturesReady:true,sourceSamplingAndMaskPreserved:true});model.dispose();
 }
 const cache=getModelTextureCacheStats(scene);if(cache.requests!==3||cache.uploads!==3||!isolation)throw Error(`Shared images/material isolation failed: ${JSON.stringify(cache)}`);clearModelPrefabCache(scene);
 return{count:27,cache,allTexturesReady:true,instanceMaterialsIndependent:isolation,models};
}
async function overview(){
 scene.lights.slice().forEach(l=>l.dispose());const key='artist-t4kum-model-test',response=await fetch(`/config/sceneEnvironmentPresets/${key}.json`);if(!response.ok)throw Error('Missing preset');
 const declaration=await response.json(),instance=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,key),{shadowQualityPresets:{}}),issues:string[]=[],used=new Set<Material>();
 for(const{definition,entity}of instance.models){const meshes=entity.meshes.filter(m=>m.getTotalVertices()),[low,high]=bounds(meshes),d=high.subtract(low),stand=declaration.objects.find((o:{id:string})=>o.id===`${definition.id}-stand`);
  if(Math.abs(low.y)>.001||Math.abs(Math.max(...d.asArray())-2.8)>.001)issues.push(`${definition.id}:bounds`);
  if(!stand||Math.abs((low.x+high.x)/2-stand.position[0])>.001||Math.abs((low.z+high.z)/2-stand.position[2])>.001)issues.push(`${definition.id}:centering`);
  checkTextures(meshes,manifest.models.find(m=>m.modelPath===definition.modelPath)!);for(const m of materials(meshes)){if(used.has(m))issues.push('Material isolation');used.add(m);}
 }
 if(issues.length)throw Error(`Layout: ${issues}`);await scene.whenReadyAsync();const[low,high]=bounds(instance.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.25;camera.beta=.75;camera.radius=high.subtract(low).length()*1.15;engine.runRenderLoop(()=>scene.render());
 (window as any).showDetail=async(category:string)=>{const entries=instance.models.filter(m=>manifest.models.find(e=>e.modelPath===m.definition.modelPath)!.category===category),[low,high]=bounds(entries.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.beta=.95;camera.radius=high.subtract(low).length()*1.25;await new Promise(r=>setTimeout(r,200));};
 await new Promise(r=>setTimeout(r,300));const cache=getModelTextureCacheStats(scene);if(cache.requests!==3||cache.uploads!==3||used.size!==27)throw Error('Overview cache/material count');
 return{presetKey:key,count:27,groups:declaration.transformNodes.length,boundsIssues:issues,independentMaterials:used.size,cache,allTexturesReady:true};
}
let captured:Awaited<ReturnType<typeof createModelEntity>>|undefined;
(window as any).captureModel=async(name:string)=>{captured?.dispose();const entry=manifest.models.find(m=>m.name===name)!;captured=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});const[low,high]=bounds(captured.meshes);camera.setTarget(low.add(high).scale(.5));camera.alpha=-.9;camera.beta=.95;camera.radius=high.subtract(low).length()*1.15;await scene.whenReadyAsync();engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,200));};
async function verifyLegacyPlacement(){
 const report=(await import('./legacy-cuboid-replacement.json')).default,models=[];
 function positions(meshes:readonly AbstractMesh[]){return meshes.flatMap(mesh=>{const data=mesh.getVerticesData('position');if(!data)return[];const matrix=mesh.computeWorldMatrix(true),points:Vector3[]=[];for(let i=0;i<data.length;i+=3)points.push(Vector3.TransformCoordinates(Vector3.FromArray(data,i),matrix));return points;});}
 for(const preset of report.presets)for(const change of preset.changes){
  const entities=[];for(const d of [change.before,change.after]){const entity=await createModelEntity(scene,d.modelPath,{transparencyPolicy:d.transparencyPolicy as 'source'|'depth-safe-cutout'});entity.root.position.copyFromFloats(...d.position as [number,number,number]);entity.root.rotation.copyFromFloats(...d.rotation as [number,number,number]);entity.root.scaling.copyFromFloats(...d.scaling as [number,number,number]);entities.push(entity);}
  await scene.whenReadyAsync();scene.render();const [a,b]=entities.map(e=>positions(e.meshes)),distance=(a:Vector3[],b:Vector3[])=>Math.max(...a.map(point=>Math.min(...b.map(other=>Vector3.Distance(point,other))))),maximumWorldVertexDistance=Math.max(distance(a,b),distance(b,a));
  if(maximumWorldVertexDistance>1e-4)throw Error(`Replacement moved model ${change.after.id}: ${maximumWorldVertexDistance}`);
  checkTextures(entities[1].meshes,manifest.models.find(m=>m.modelPath===change.after.modelPath)!);
  models.push({preset:preset.path,id:change.after.id,modelPath:change.after.modelPath,maximumWorldVertexDistance,allTexturesReady:true});entities.forEach(e=>e.dispose());
 }
 return{count:models.length,allTexturesReady:true,maximumWorldVertexDistance:Math.max(...models.map(m=>m.maximumWorldVertexDistance)),models};
}
const query=new URLSearchParams(location.search);
(window as any).result=query.has('legacy')?verifyLegacyPlacement():query.has('overview')?overview():verify();
