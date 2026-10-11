import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,Color4,MultiMaterial,PBRMaterial,Texture,type AbstractMesh,type Material} from '@babylonjs/core';
import {createModelEntity,clearModelPrefabCache,getModelTextureCacheStats} from '../../../core/model';
import {parseSceneEnvironmentPreset} from '../../../core/scene/sceneEnvironment.parser';
import {createSceneEnvironmentAsync} from '../../../core/scene/createSceneEnvironment';
import manifest from './manifest.json';
const engine=new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);scene.clearColor=new Color4(.1,.14,.18,1);
const camera=new ArcRotateCamera('camera',-.9,1.05,8,Vector3.Zero(),scene);camera.minZ=.001;camera.maxZ=5000;new HemisphericLight('light',new Vector3(.3,1,.2),scene).intensity=1.2;
function bounds(meshes:readonly AbstractMesh[]){let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate();for(const mesh of meshes.filter(m=>m.getTotalVertices())){const matrix=mesh.computeWorldMatrix(true),data=mesh.getVerticesData('position')!;for(let i=0;i<data.length;i+=3){const point=Vector3.TransformCoordinates(Vector3.FromArray(data,i),matrix);low.minimizeInPlace(point);high.maximizeInPlace(point);}}return[low,high];}
function materials(meshes:readonly AbstractMesh[]){return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]).filter(Boolean))] as PBRMaterial[];}
function checkTextures(meshes:readonly AbstractMesh[],entry:typeof manifest.models[number]){
 const ms=materials(meshes);if(ms.length!==entry.materialCount)throw Error(`Material count: ${entry.name}`);
 for(const m of ms){const setting=entry.materials.find(s=>m.name.includes(s.name));if(!setting)throw Error(`Unexpected material: ${m.name}`);const file=entry.images[setting.pbrMetallicRoughness.baseColorTexture.index];
  const t=m.albedoTexture as Texture|undefined,url=t?.url?.startsWith('data:model-shared:')?JSON.parse(t.url.slice('data:model-shared:'.length))[0]:t?.url,record=manifest.authors[0].images.find(i=>String(url).endsWith(i.texturePath));
  if(!t?.isReady()||!record||record.file!==file)throw Error(`Missing/wrong image: ${entry.name}`);
  const size=t.getSize();if(size.width!==record.width||size.height!==record.height||t.samplingMode!==Texture.TRILINEAR_SAMPLINGMODE||t.wrapU!==Texture.WRAP_ADDRESSMODE||t.wrapV!==Texture.WRAP_ADDRESSMODE||!(t.gammaSpace||t.getInternalTexture()?._useSRGBBuffer))throw Error('Image dimensions/source sampling changed');
  if(Math.abs(m.roughness!-setting.pbrMetallicRoughness.roughnessFactor)>1e-6||m.metallic!==setting.pbrMetallicRoughness.metallicFactor||m.backFaceCulling===setting.doubleSided)throw Error('Source PBR changed');
  if('alphaMode' in setting&&(m.transparencyMode!==PBRMaterial.PBRMATERIAL_ALPHATEST||m.alphaCutOff!==.5||!t.hasAlpha||!m.useAlphaFromAlbedoTexture))throw Error('RGBA cutout lost');
 }
}
async function verify(){const models=[];let independent=false;
 for(const entry of manifest.models){const model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'}),meshes=model.meshes.filter(m=>m.getTotalVertices());
  // Babylon creates one render mesh per material primitive, so count source nodes separately.
  if(model.animationGroups.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error('Missing UV/normal data');
  for(const mesh of meshes){const normals=mesh.getVerticesData('normal')!;for(let i=0;i<normals.length;i+=3)if(Math.abs(Vector3.FromArray(normals,i).length()-1)>.001)throw Error('Invalid unit normal');}
  const[low,high]=bounds(meshes);if(Math.abs(low.y)>1e-4||Math.abs((low.x+high.x)/2)>1e-4||Math.abs((low.z+high.z)/2)>1e-4)throw Error('Model origin not centered/grounded');await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry);
  if(entry.name==='ToolBoxClosed'){const peer=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});if(materials(peer.meshes)[0]===materials(meshes)[0])throw Error('Instance material shared');independent=true;peer.dispose();}
  const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);if(triangles!==entry.sourceTriangles)throw Error('Source triangles changed');models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],sourceMeshes:entry.meshCount,renderMeshes:meshes.length,triangles,allTexturesReady:true,sourceSamplingAndPBRPreserved:true});model.dispose();
 }
 const cache=getModelTextureCacheStats(scene);if(cache.requests!==24||cache.uploads!==24||!independent)throw Error('Shared cache/isolation mismatch');clearModelPrefabCache(scene);return{count:32,allTexturesReady:true,instanceMaterialsIndependent:independent,cache,models};
}
async function overview(){scene.lights.slice().forEach(l=>l.dispose());const key='artist-doctor-sci3nce-model-test',declaration=await(await fetch(`/config/sceneEnvironmentPresets/${key}.json`)).json(),instance=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(declaration,key),{shadowQualityPresets:{}}),used=new Set<Material>();
 for(const {definition,entity}of instance.models){const[low,high]=bounds(entity.meshes),d=high.subtract(low),stand=declaration.objects.find((o:{id:string})=>o.id===definition.id+'-stand');if(Math.abs(low.y)>.001||Math.abs(Math.max(...d.asArray())-2.8)>.001||Math.abs((low.x+high.x)/2-stand.position[0])>.001||Math.abs((low.z+high.z)/2-stand.position[2])>.001)throw Error('Preset layout mismatch');checkTextures(entity.meshes,manifest.models.find(m=>m.modelPath===definition.modelPath)!);for(const m of materials(entity.meshes)){if(used.has(m))throw Error('Shared instance material');used.add(m);}}
 await scene.whenReadyAsync();const[low,high]=bounds(instance.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.25;camera.beta=.75;camera.radius=high.subtract(low).length()*1.15;engine.runRenderLoop(()=>scene.render());
 (window as any).showDetail=async(category:string)=>{const entries=instance.models.filter(m=>manifest.models.find(e=>e.modelPath===m.definition.modelPath)!.category===category),[low,high]=bounds(entries.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.beta=.95;camera.radius=high.subtract(low).length()*1.25;await new Promise(r=>setTimeout(r,200));};
 await new Promise(r=>setTimeout(r,300));const cache=getModelTextureCacheStats(scene);if(cache.requests!==24||cache.uploads!==24||used.size!==38)throw Error('Scene material/cache count');return{presetKey:key,count:32,groups:3,independentMaterials:used.size,boundsIssues:[],allTexturesReady:true,cache};
}
let captured:Awaited<ReturnType<typeof createModelEntity>>|undefined;(window as any).captureModel=async(name:string)=>{captured?.dispose();const entry=manifest.models.find(m=>m.name===name)!;captured=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});const[low,high]=bounds(captured.meshes);camera.setTarget(low.add(high).scale(.5));camera.alpha=-.9;camera.beta=.95;camera.radius=high.subtract(low).length()*1.15;await scene.whenReadyAsync();engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,200));};
(window as any).result=new URLSearchParams(location.search).has('overview')?overview():verify();
