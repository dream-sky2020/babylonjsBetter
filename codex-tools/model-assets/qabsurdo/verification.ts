import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,MultiMaterial,PBRMaterial,Texture,type AbstractMesh,type Material} from '@babylonjs/core';
import {createModelEntity,clearModelPrefabCache,getModelTextureCacheStats} from '../../../core/model';
import {parseSceneEnvironmentPreset} from '../../../core/scene/sceneEnvironment.parser';
import {createSceneEnvironmentAsync} from '../../../core/scene/createSceneEnvironment';
import manifest from './manifest.json';
const engine=new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true}),scene=new Scene(engine),camera=new ArcRotateCamera('camera',-.9,1,8,Vector3.Zero(),scene);camera.minZ=.001;camera.maxZ=5000;new HemisphericLight('light',new Vector3(.3,1,.2),scene).intensity=1.2;
const imageRecords=manifest.authors.flatMap(a=>a.images);
function bounds(meshes:readonly AbstractMesh[]){let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate();for(const mesh of meshes.filter(m=>m.getTotalVertices())){const matrix=mesh.computeWorldMatrix(true),data=mesh.getPositionData(true,true)!;for(let i=0;i<data.length;i+=3){const p=Vector3.TransformCoordinates(Vector3.FromArray(data,i),matrix);low.minimizeInPlace(p);high.maximizeInPlace(p);}}return[low,high];}
function materials(meshes:readonly AbstractMesh[]){return [...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials.filter(Boolean):[m.material]).filter(Boolean))] as PBRMaterial[];}
function checkTextures(meshes:readonly AbstractMesh[],entry:typeof manifest.models[number]){
 const ms=materials(meshes);if(ms.length!==entry.materialCount)throw Error('Material count: '+entry.name);
 for(const m of ms){const setting=[...entry.materials].sort((a,b)=>b.name.length-a.name.length).find(s=>m.name.includes(s.name));if(!setting)throw Error('Material name: '+m.name);
  const pbr=setting.pbrMetallicRoughness,roles:[any,any,boolean][]=[[m.albedoTexture,pbr?.baseColorTexture,true],[m.bumpTexture,(setting as any).normalTexture,false],[m.emissiveTexture,(setting as any).emissiveTexture,true],[m.metallicTexture,(pbr as any)?.metallicRoughnessTexture,false]];
  for(const [t,reference,gamma]of roles){if(!reference)continue;const texture=entry.textures[reference.index],filename=entry.images[texture.source],record=imageRecords.find(i=>i.file===filename);const url=t?.url?.startsWith('data:model-shared:')?JSON.parse(t.url.slice('data:model-shared:'.length))[0]:t?.url;
   if(!record||!t?.isReady()||!String(url).endsWith(record.texturePath))throw Error('Wrong/missing texture '+entry.name+' '+m.name+' '+filename+' '+url);
   const size=t.getSize();if(size.width!==record.width||size.height!==record.height)throw Error('Wrong image size');
   const sampler=entry.samplers[texture.sampler??0],expectedMode=sampler.magFilter===9728?Texture.NEAREST_NEAREST_MIPNEAREST:Texture.TRILINEAR_SAMPLINGMODE;
   if(t.samplingMode!==expectedMode)throw Error('Sampler changed: '+entry.name+' '+t.samplingMode);
   const transform=reference.extensions?.KHR_texture_transform;if(transform&&(Math.abs(t.uScale-transform.scale[0])>1e-6||Math.abs(t.vScale-transform.scale[1])>1e-6||Math.abs(t.uOffset-transform.offset[0])>1e-6||Math.abs(t.vOffset-transform.offset[1])>1e-6))throw Error('Texture transform lost');
   if(gamma&&!(t.gammaSpace||t.getInternalTexture()?._useSRGBBuffer))throw Error('Color texture gamma lost');
  }
  if(pbr&&((pbr as any).roughnessFactor!==undefined&&Math.abs(m.roughness!-(pbr as any).roughnessFactor)>1e-6||(pbr as any).metallicFactor!==undefined&&m.metallic!==(pbr as any).metallicFactor))throw Error('PBR changed');
  if(Math.abs(m.alpha-((pbr as any)?.baseColorFactor?.[3]??1))>1e-6)throw Error('Opacity lost');
  if((setting as any).alphaMode==='BLEND'&&m.transparencyMode!==PBRMaterial.PBRMATERIAL_ALPHABLEND)throw Error('Glass blend lost');
  if((setting as any).alphaMode==='OPAQUE'&&m.transparencyMode!==PBRMaterial.PBRMATERIAL_OPAQUE)throw Error('Solid material disappeared');
  if((setting as any).alphaMode==='MASK'&&(m.transparencyMode!==PBRMaterial.PBRMATERIAL_ALPHATEST||Math.abs(m.alphaCutOff-((setting as any).alphaCutoff??.5))>1e-6))throw Error('Cutout changed');
 }
}
async function verify(){const models=[];let independent=false;
 for(const entry of manifest.models){const model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'}),meshes=model.meshes.filter(m=>m.getTotalVertices());
  await scene.whenReadyAsync();scene.render();checkTextures(meshes,entry);
  if(model.animationGroups.length!==entry.animations)throw Error('Animation lost');if(entry.skins&&!meshes.some(m=>m.skeleton))throw Error('Skeleton lost');
  for(const mesh of meshes){if(!mesh.isVerticesDataPresent('uv')||!mesh.isVerticesDataPresent('normal'))throw Error('Missing source attributes');const normals=mesh.getVerticesData('normal')!;for(let i=0;i<normals.length;i+=3)if(Math.abs(Vector3.FromArray(normals,i).length()-1)>.002)throw Error('Invalid normal '+entry.name);}
  const[low,high]=bounds(meshes);if(!entry.skins&&(Math.abs(low.y)>.002||Math.abs((low.x+high.x)/2)>.002||Math.abs((low.z+high.z)/2)>.002))throw Error('Not centered/grounded '+entry.name+' '+low+' '+high);
  if(entry.name==='WallFull07'){const peer=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});if(materials(peer.meshes)[0]===materials(meshes)[0])throw Error('Material isolation lost');independent=true;peer.dispose();}
  const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);if(triangles!==entry.sourceTriangles)throw Error('Triangle loss');models.push({modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],triangles,renderMeshes:meshes.length,animations:model.animationGroups.length,sourceTexturesReady:true});model.dispose();
 }
 const cache=getModelTextureCacheStats(scene);if(cache.requests!==imageRecords.length||cache.uploads!==imageRecords.length||!independent)throw Error('Shared cache failed '+JSON.stringify(cache));clearModelPrefabCache(scene);return{count:models.length,allTexturesReady:true,instanceMaterialsIndependent:independent,cache,models};
}
async function overview(){camera.minZ=.1;scene.lights.slice().forEach(l=>l.dispose());const key='artist-qabsurdo-model-test',d=await(await fetch(`/config/sceneEnvironmentPresets/${key}.json`)).json(),instance=await createSceneEnvironmentAsync(scene,parseSceneEnvironmentPreset(d,key),{shadowQualityPresets:{}}),used=new Set<Material>();
 for(const {definition,entity}of instance.models){const[low,high]=bounds(entity.meshes),stand=d.objects.find((o:any)=>o.id===definition.id+'-stand');if(Math.abs(low.y)>.003||Math.abs(Math.max(...high.subtract(low).asArray())-2.8)>.003||Math.abs((low.x+high.x)/2-stand.position[0])>.003||Math.abs((low.z+high.z)/2-stand.position[2])>.003)throw Error('Bad layout '+definition.name);checkTextures(entity.meshes,manifest.models.find(m=>m.modelPath===definition.modelPath)!);for(const m of materials(entity.meshes)){if(used.has(m))throw Error('Shared material');used.add(m);}}
 await scene.whenReadyAsync();const[low,high]=bounds(instance.models.flatMap(m=>m.entity.meshes));camera.setTarget(low.add(high).scale(.5));camera.alpha=-Math.PI/2-.2;camera.beta=.85;camera.radius=high.subtract(low).length()*1.05;engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,300));
 const cache=getModelTextureCacheStats(scene);if(cache.requests!==imageRecords.length||cache.uploads!==imageRecords.length)throw Error('Overview cache');return{presetKey:key,count:instance.models.length,independentMaterials:used.size,allTexturesReady:true,cache};
}
let captured:Awaited<ReturnType<typeof createModelEntity>>|undefined;(window as any).captureModel=async(name:string)=>{captured?.dispose();const entry=manifest.models.find(m=>m.name===name)!;captured=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});const[low,high]=bounds(captured.meshes);camera.setTarget(low.add(high).scale(.5));camera.alpha=-.9;camera.beta=1;camera.radius=high.subtract(low).length()*1.2;await scene.whenReadyAsync();engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,200));};
(window as any).result=new URLSearchParams(location.search).has('overview')?overview():verify();
