import {Engine,Scene,ArcRotateCamera,Vector3,HemisphericLight,DirectionalLight,Color4,LoadAssetContainerAsync} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {createModelEntity} from '../../../core/model';
const canvas=document.querySelector('canvas')!;
const engine=new Engine(canvas,false,{preserveDrawingBuffer:true,stencil:true});
const scene=new Scene(engine);scene.clearColor=new Color4(.12,.16,.2,1);
const camera=new ArcRotateCamera('camera',-.9,1,8,Vector3.Zero(),scene);camera.minZ=.0001;camera.maxZ=100000;
new HemisphericLight('sky',new Vector3(.3,1,.2),scene).intensity=.8;
new DirectionalLight('sun',new Vector3(-1,-2,1),scene).intensity=2;
const stage='/.asset-migration/loafbrr/wall-beam-optimization/';
const plan=await(await fetch(stage+'plan.json')).json();
async function capture(){await scene.whenReadyAsync();scene.render();scene.render();return new Uint8Array(await engine.readPixels(0,0,768,768));}
function bounds(meshes:any[]){let min=new Vector3(Infinity,Infinity,Infinity),max=min.negate();for(const m of meshes.filter(m=>m.getTotalVertices())){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;min.minimizeInPlace(b.minimumWorld);max.maximizeInPlace(b.maximumWorld);}return {min,max};}
async function verify(){
 const models=[];const screenshots:any[]=[];
 for(const entry of plan.models){
  const name=entry.modelPath.split('/').pop();
  const before=await LoadAssetContainerAsync(stage+'before-'+name,scene),after=await LoadAssetContainerAsync(stage+'after-'+name,scene);
  const a=bounds(before.meshes),b=bounds(after.meshes);if(!a.min.equals(b.min)||!a.max.equals(b.max))throw Error('Bounds changed');
  const span=a.max.subtract(a.min).length();camera.setTarget(a.min.add(a.max).scale(.5));camera.minZ=span/10000;
  for(const c of [before,after])for(const t of c.textures){if(!t.isReady())await scene.whenReadyAsync();if(!t.isReady())throw Error('Texture not ready');}
  const views=[];
  for(const distance of [1,2,8,32,128])for(let angle=0;angle<6;angle++){
   camera.radius=span*distance;camera.alpha=angle*Math.PI/3-.9;camera.beta=[.65,1.2,2.2][angle%3];
   before.addAllToScene();const old=await capture();
   if(distance===1&&angle===0)screenshots.push({name:name+'-before.png',data:canvas.toDataURL('image/png')});
   before.removeAllFromScene();after.addAllToScene();const now=await capture();
   if(distance===1&&angle===0)screenshots.push({name:name+'-after.png',data:canvas.toDataURL('image/png')});
   after.removeAllFromScene();const background=await capture();
   let count=0,sum=0,max=0,large=0;
   for(let i=0;i<old.length;i+=4){if([0,1,2].every(k=>old[i+k]===background[i+k]&&now[i+k]===background[i+k]))continue;count++;let delta=0;for(let k=0;k<3;k++){const d=Math.abs(old[i+k]-now[i+k]);sum+=d;max=Math.max(max,d);delta=Math.max(delta,d);}if(delta>12)large++;}
   const result={distance,angle,objectPixels:count,meanAbsoluteChannelError:sum/Math.max(1,count*3),maxChannelError:max,pixelsOver12Fraction:large/Math.max(1,count)};
   // Coarse mipmaps differ; gate on object pixels, never background dilution.
   Object.assign(result,{passed:result.meanAbsoluteChannelError<=2&&result.pixelsOver12Fraction<=.02});
   views.push(result);(window as any).progress={name,distance,angle};
  }
  models.push({modelPath:entry.modelPath,views,textureSizes:after.textures.map(t=>t.getSize()),bounds:[a.min.asArray(),a.max.asArray()]});before.dispose();after.dispose();
 }
 return {passed:models.every(m=>m.views.every((v:any)=>v.passed)),models,screenshots,renderer:engine.getGlInfo(),limits:{meanAbsoluteChannelError:2,pixelsOver12Fraction:.02},note:'Object-only comparisons; 6 directions x 5 distances; original filtering and mipmaps. Coarse mip levels are not mathematically identical.'};
}
async function published(){
 const results=[],screenshots=[];
 for(const entry of plan.models){
  const e=await createModelEntity(scene,entry.modelPath,{applyAssetProfile:false,transparencyPolicy:'source'});
  const b=bounds([...e.meshes]);camera.setTarget(b.min.add(b.max).scale(.5));camera.radius=b.max.subtract(b.min).length()*2;camera.alpha=-.9;camera.beta=1;
  const live=await capture();
  const ts=[...new Set(e.meshes.flatMap(m=>m.material?.getActiveTextures()??[]))];
  if(ts.length!==3)throw Error('Wrong texture count');
  for(const t of ts){if(!t.isReady()||t.getSize().width!==512||t.getSize().height!==384)throw Error('Published texture not loaded/cropped');}
  screenshots.push({name:entry.modelPath.split('/').pop()+'-published.png',data:canvas.toDataURL('image/png')});
  e.root.setEnabled(false);
  const reference=await LoadAssetContainerAsync(stage+'after-'+entry.modelPath.split('/').pop(),scene);reference.addAllToScene();
  const expected=await capture();let max=0;for(let i=0;i<live.length;i++)max=Math.max(max,Math.abs(live[i]-expected[i]));
  if(max>1)throw Error('Shared-texture rendering differs from validated candidate: '+max);
  reference.dispose();
  results.push({modelPath:entry.modelPath,texturesReady:ts.length,triangles:e.meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),maxDifferenceVsValidatedCandidate:max});e.dispose();
 }
 return {passed:true,models:results,screenshots};
}
(window as any).result=new URLSearchParams(location.search).has('published')?published():verify();
