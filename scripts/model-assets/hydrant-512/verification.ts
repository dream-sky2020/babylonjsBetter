import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,Color4,MultiMaterial,PBRMaterial,type AbstractMesh} from '@babylonjs/core';
import {createModelEntity,getModelTextureCacheStats} from '../../../core/model';
import manifest from '../three-authors/manifest.json';
import previous from '../three-authors/validation.json';
const entry=manifest.models.find(m=>m.author==='artist_duhgless'&&m.name==='Hydrant')!;
const engine=new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);
scene.clearColor=new Color4(.12,.16,.19,1);new HemisphericLight('light',new Vector3(.4,1,-.5),scene).intensity=1.4;
const camera=new ArcRotateCamera('camera',-Math.PI/2-.5,1.1,10,Vector3.Zero(),scene);camera.minZ=.001;
function bounds(meshes:readonly AbstractMesh[]){
  let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate();const local=Vector3.Zero(),world=Vector3.Zero();
  for(const mesh of meshes.filter(m=>m.getTotalVertices())){const matrix=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position')!;
    for(let i=0;i<positions.length;i+=3){local.set(positions[i],positions[i+1],positions[i+2]);Vector3.TransformCoordinatesToRef(local,matrix,world);low=Vector3.Minimize(low,world);high=Vector3.Maximize(high,world);}}
  return[low,high];
}
async function verify(){
  const model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false}),meshes=model.meshes.filter(m=>m.getTotalVertices());
  if(!meshes.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error('Geometry/UV/normal missing');
  const[low,high]=bounds(meshes),old=previous.models.find(m=>m.modelPath===entry.modelPath)!;
  for(const[side,value]of [low.asArray(),high.asArray()].entries())for(let i=0;i<3;i++)if(Math.abs(value[i]-old.bounds[side][i])>1e-6)throw Error('Bounds changed');
  const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);if(triangles!==820)throw Error('Geometry changed');
  const all=[...new Set(meshes.flatMap(m=>m.material instanceof MultiMaterial?m.material.subMaterials:[m.material]))] as PBRMaterial[];
  if(all.length!==1)throw Error('Material count changed');const material=all[0];
  await scene.whenReadyAsync();for(const texture of [material.albedoTexture,material.bumpTexture]){if(!texture?.isReady())throw Error('Missing texture');const size=texture.getSize();if(size.width!==512||size.height!==512)throw Error('Texture resolution mismatch');}
  if(Math.abs(material.bumpTexture!.level-.5)>1e-6)throw Error('Normal strength changed');
  const second=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false});
  const secondMaterial=second.meshes.find(m=>m.getTotalVertices())!.material as PBRMaterial;
  if(secondMaterial===material||secondMaterial.albedoTexture?.getInternalTexture()!==material.albedoTexture?.getInternalTexture()||secondMaterial.bumpTexture?.getInternalTexture()!==material.bumpTexture?.getInternalTexture())throw Error('Material isolation or image sharing failed');
  second.dispose();const cache=getModelTextureCacheStats(scene);if(cache.requests!==2||cache.uploads!==2)throw Error('Unexpected image upload count');
  camera.setTarget(low.add(high).scale(.5));camera.radius=high.subtract(low).length()*1.25;engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,300));
  return{modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,triangles,animations:model.animationGroups.length,
    allTexturesReady:true,textureSize:[512,512],normalStrength:material.bumpTexture!.level,independentMaterials:true,sharedImages:true,cache};
}
(window as any).result=verify();
