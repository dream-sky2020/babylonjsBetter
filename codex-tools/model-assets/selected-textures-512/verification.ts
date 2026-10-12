import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,Color4,PBRMaterial,type AbstractMesh} from '@babylonjs/core';
import {createModelEntity,getModelTextureCacheStats} from '../../../core/model';
import report from './report.json';
import seven from '../seven-authors/validation.json';
import ray from '../rayzngames/validation.json';
const engine=new Engine(document.querySelector('canvas')!,true,{preserveDrawingBuffer:true}),scene=new Scene(engine);
scene.clearColor=new Color4(.12,.16,.19,1);new HemisphericLight('light',new Vector3(.4,1,-.5),scene).intensity=1.4;
const camera=new ArcRotateCamera('camera',-.9,1.05,10,Vector3.Zero(),scene);camera.minZ=.001;
function bounds(meshes:readonly AbstractMesh[]){let low=new Vector3(Infinity,Infinity,Infinity),high=low.negate(),local=Vector3.Zero(),world=Vector3.Zero();
 for(const mesh of meshes.filter(m=>m.getTotalVertices())){const matrix=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position')!;for(let i=0;i<positions.length;i+=3){local.set(positions[i],positions[i+1],positions[i+2]);Vector3.TransformCoordinatesToRef(local,matrix,world);low=Vector3.Minimize(low,world);high=Vector3.Maximize(high,world);}}return[low,high];}
let current:Awaited<ReturnType<typeof createModelEntity>>|undefined;
async function load(index:number){current?.dispose();const entry=report.models[index],model=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false});current=model;const meshes=model.meshes.filter(m=>m.getTotalVertices());
 if(!meshes.length||meshes.some(m=>!m.isVerticesDataPresent('uv')||!m.isVerticesDataPresent('normal')))throw Error('Missing geometry/UV/normal');
 const previous=[...seven.models,...ray.models].find(m=>m.modelPath===entry.modelPath)!,[low,high]=bounds(meshes);for(const[side,values]of [low.asArray(),high.asArray()].entries())for(let i=0;i<3;i++)if(Math.abs(values[i]-previous.bounds[side][i])>1e-6)throw Error('Bounds changed');
 const triangles=meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0);if(triangles!==previous.triangles)throw Error('Triangle count changed');
 await scene.whenReadyAsync();const mats=[...new Set(meshes.map(m=>m.material))] as PBRMaterial[];if(mats.length!==1)throw Error('Material count changed');const mat=mats[0];
 const slots=[mat.albedoTexture,mat.bumpTexture,mat.metallicTexture,...(index===0?[mat.ambientTexture]:[mat.emissiveTexture])];
 for(const texture of slots){if(!texture?.isReady())throw Error('PBR texture not ready');const size=texture.getSize();if(size.width!==512||size.height!==512)throw Error('Texture size mismatch');}
 if(index===1&&mat.transparencyMode!==PBRMaterial.PBRMATERIAL_ALPHATEST)throw Error('City alpha cutout lost');
 const second=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false}),other=second.meshes.find(m=>m.getTotalVertices())!.material as PBRMaterial;
 if(other===mat||other.albedoTexture!.getInternalTexture()!==mat.albedoTexture!.getInternalTexture()||other.bumpTexture!.getInternalTexture()!==mat.bumpTexture!.getInternalTexture())throw Error('Material isolation or image sharing failed');second.dispose();
 camera.setTarget(low.add(high).scale(.5));camera.alpha=-.9;camera.beta=1.05;camera.radius=high.subtract(low).length()*1.25;engine.runRenderLoop(()=>scene.render());await new Promise(r=>setTimeout(r,250));
 return{modelPath:entry.modelPath,sha256:entry.sha256,bounds:[low.asArray(),high.asArray()],meshes:meshes.length,triangles,animations:model.animationGroups.length,allTexturesReady:true,textureSize:[512,512],geometryAndMaterialsUnchanged:true,independentMaterials:true,sharedImages:true,cache:getModelTextureCacheStats(scene)};
}
(window as any).load=load;
(window as any).result=Promise.resolve({ready:true});
