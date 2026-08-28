/* eslint-disable react-refresh/only-export-components, react-hooks/exhaustive-deps, react-hooks/refs */
import React,{useEffect,useMemo,useRef,useState}from'react';
import{createRoot}from'react-dom/client';
import{ArcRotateCamera,Color4,Engine,Scene,Vector3}from'@babylonjs/core';
import{requestDevServer}from'@/core/network/devServerPortResolver.ts';
import{loadConfig}from'@/core/config';
import{createSpriteAshEffect,normalizeSpriteAshPreset,normalizeSpriteAshPresetLibrary,SPRITE_ASH_PARAMETER_DEFINITIONS,SPRITE_ASH_GROUP_FEATURES,type SpriteAshEffectController,type SpriteAshPreset,type SpriteAshPresetLibrary}from'@/core/sprite';

const PRESET_URL='/config/spriteAshPresets.json',PRESET_API='/api/sprite-ash-presets';
const resourceModules=import.meta.glob('/public/resources/**/*.{png,jpg,jpeg,webp}');
const imagePaths=Object.keys(resourceModules).map(path=>path.replace(/^\/public/,'')).sort((a,b)=>a.localeCompare(b,'zh-CN'));
const preferredImage=imagePaths.find(path=>decodeURI(path).includes('食肉精灵.png'))||imagePaths[0]||'/resources/particle_white.svg';
const radians=(degrees:number)=>degrees*Math.PI/180;
const PARTICLE_MODE_OPTIONS=[
 {value:'none',label:'无'},
 {value:'ash',label:'灰烬'},
 {value:'blackShards',label:'黑色碎片'},
 {value:'embers',label:'余烬'},
 {value:'pixel',label:'像素块'}
] as const;

const App:React.FC=()=>{
 const canvasRef=useRef<HTMLCanvasElement>(null),sceneRef=useRef<Scene|null>(null),controllerRef=useRef<SpriteAshEffectController|null>(null);
 const progressRef=useRef(0),playingRef=useRef(false),loopRef=useRef(true),speedRef=useRef(1),presetRef=useRef<SpriteAshPreset|undefined>(undefined);
 const[imagePath,setImagePath]=useState(preferredImage),[presets,setPresets]=useState<SpriteAshPresetLibrary>({}),[presetKey,setPresetKey]=useState('');
 const[progress,setProgressState]=useState(0),[playing,setPlaying]=useState(false),[loop,setLoop]=useState(true),[speed,setSpeed]=useState(1);
 const[displayScale,setDisplayScale]=useState(5),[rotation,setRotation]=useState({x:0,y:0,z:0}),[billboard,setBillboard]=useState(false);
 const[message,setMessage]=useState('正在加载化灰预设…'),[isError,setIsError]=useState(false);
 const activePreset=presets[presetKey]||Object.values(presets)[0];
 const groups=useMemo(()=>[...new Set(SPRITE_ASH_PARAMETER_DEFINITIONS.map(item=>item.group))],[]);
 useEffect(()=>{presetRef.current=activePreset},[activePreset]);useEffect(()=>{progressRef.current=progress},[progress]);useEffect(()=>{playingRef.current=playing},[playing]);useEffect(()=>{loopRef.current=loop},[loop]);useEffect(()=>{speedRef.current=speed},[speed]);

 const applyProgress=(value:number)=>{const next=Math.max(0,Math.min(1,value));progressRef.current=next;setProgressState(next);controllerRef.current?.setProgress(next)};
 const updatePreset=(next:SpriteAshPreset)=>{const normalized=normalizeSpriteAshPreset(next.presetKey,next);setPresets(current=>({...current,[normalized.presetKey]:normalized}));controllerRef.current?.setPreset(normalized)};
 const reset=()=>{setPlaying(false);applyProgress(0)};
 const replay=()=>{applyProgress(0);setPlaying(true)};

 useEffect(()=>{loadConfig<unknown>(PRESET_URL).then(raw=>{const next=normalizeSpriteAshPresetLibrary(raw);setPresets(next);setPresetKey(Object.keys(next)[0]||'');setMessage(`已加载 ${Object.keys(next).length} 个精灵化灰预设。`)}).catch(error=>{setIsError(true);setMessage(`加载失败：${String(error)}`)})},[]);

 useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});const scene=new Scene(engine);scene.clearColor=new Color4(.035,.05,.075,1);const camera=new ArcRotateCamera('spriteAshCamera',-Math.PI/2,Math.PI/2.15,12,new Vector3(0,0,0),scene);camera.lowerRadiusLimit=3;camera.upperRadiusLimit=30;camera.wheelPrecision=25;camera.attachControl(canvas,true);sceneRef.current=scene;let time=0,lastUi=0;engine.runRenderLoop(()=>{const dt=engine.getDeltaTime()/1000;time+=dt;const controller=controllerRef.current;if(controller){controller.updateTime(time);if(playingRef.current){const duration=Math.max(.1,presetRef.current?.duration||1);let next=progressRef.current+dt*speedRef.current/duration;if(next>=1){if(loopRef.current)next%=1;else{next=1;playingRef.current=false;setPlaying(false)}}progressRef.current=next;controller.setProgress(next);if(time-lastUi>.035){lastUi=time;setProgressState(next)}}}scene.render()});const resize=()=>engine.resize();window.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);controllerRef.current?.dispose();controllerRef.current=null;sceneRef.current=null;scene.dispose();engine.dispose()}},[]);

 useEffect(()=>{const scene=sceneRef.current;if(!scene||!activePreset)return;controllerRef.current?.dispose();const controller=createSpriteAshEffect(scene,imagePath,activePreset);controller.setDisplayScale(displayScale);controller.setProgress(progressRef.current);controller.mesh.rotation.set(radians(rotation.x),radians(rotation.y),radians(rotation.z));controller.mesh.billboardMode=billboard?7:0;controllerRef.current=controller;return()=>{if(controllerRef.current===controller)controllerRef.current=null;controller.dispose()}},[imagePath,activePreset?.presetKey]);
 useEffect(()=>{const controller=controllerRef.current;if(!controller)return;controller.setDisplayScale(displayScale);controller.mesh.rotation.set(radians(rotation.x),radians(rotation.y),radians(rotation.z));controller.mesh.billboardMode=billboard?7:0},[displayScale,rotation,billboard]);
 useEffect(()=>{if(activePreset)controllerRef.current?.setPreset(activePreset)},[activePreset]);

 const addPreset=()=>{const source=activePreset;if(!source)return;const key=`sprite_ash_${Date.now().toString(36)}`,next={...source,presetKey:key,name:'新精灵化灰预设'};setPresets(current=>({...current,[key]:next}));setPresetKey(key)};
 const duplicate=()=>{if(!activePreset)return;const key=`${activePreset.presetKey}_copy_${Date.now().toString(36)}`,next={...activePreset,presetKey:key,name:`${activePreset.name} 副本`};setPresets(current=>({...current,[key]:next}));setPresetKey(key)};
 const remove=()=>{if(!activePreset||Object.keys(presets).length<=1)return;const next={...presets};delete next[activePreset.presetKey];setPresets(next);setPresetKey(Object.keys(next)[0]||'')};
 const save=async()=>{try{const payload=Object.fromEntries(Object.entries(presets).map(([key,value])=>[key,normalizeSpriteAshPreset(key,value)]));const response=await requestDevServer(PRESET_API,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();if(!response.ok||result.success===false)throw new Error(result.errors?.[0]||result.message||`HTTP ${response.status}`);setIsError(false);setMessage(`已保存 ${Object.keys(payload).length} 个精灵化灰预设。`)}catch(error){setIsError(true);setMessage(`保存失败：${String(error)}`)}};

 return <div className="lab"><aside className="panel"><h1>精灵消散效果 Lab</h1><div className="subtle">编辑、保存并预览可供精灵与怪物使用的消散预设。</div>
  <label>精灵图片</label><select value={imagePath} onChange={event=>setImagePath(event.target.value)}>{imagePaths.map(path=><option key={path} value={path}>{decodeURI(path).split('/').pop()}</option>)}</select>
  <section className="section"><div className="section-head"><strong>预设</strong><button onClick={addPreset} disabled={!activePreset}>新增</button></div><label>消散预设</label><select value={activePreset?.presetKey||''} onChange={event=>setPresetKey(event.target.value)}>{Object.values(presets).map(item=><option key={item.presetKey} value={item.presetKey}>{item.name} · {item.presetKey}</option>)}</select>{activePreset&&<><label>边缘粒子</label><select value={activePreset.particleMode} onChange={event=>updatePreset({...activePreset,particleMode:event.target.value as SpriteAshPreset['particleMode']})}>{PARTICLE_MODE_OPTIONS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select><div className="effect-note">本体消散由下方场结构参数混合生成，粒子类型与消散场相互独立。</div><label>预设名称</label><input type="text" value={activePreset.name} onChange={event=>updatePreset({...activePreset,name:event.target.value})}/><div className="grid2 section"><button onClick={duplicate}>复制</button><button onClick={remove} disabled={Object.keys(presets).length<=1}>删除</button></div></>}</section>
  <section className="section"><strong>播放预览</strong><label>化灰进度</label><div className="progress-line"><input type="range" min="0" max="1" step="0.001" value={progress} onChange={event=>applyProgress(Number(event.target.value))}/><input type="number" min="0" max="1" step="0.01" value={progress.toFixed(3)} onChange={event=>applyProgress(Number(event.target.value))}/></div><div className="controls"><button className="primary" onClick={()=>setPlaying(value=>!value)}>{playing?'暂停':'播放'}</button><button onClick={replay}>从头播放</button><button onClick={reset}>重置</button><button onClick={()=>{setLoop(value=>!value)}}>{loop?'循环：开':'循环：关'}</button></div><label>播放速度</label><input type="number" min="0.05" max="8" step="0.05" value={speed} onChange={event=>setSpeed(Math.max(.05,Number(event.target.value)||1))}/></section>
  <section className="section"><strong>3D 展示</strong><div className="grid2"><div><label>精灵尺寸</label><input type="number" min=".1" max="30" step=".1" value={displayScale} onChange={event=>setDisplayScale(Number(event.target.value)||1)}/></div><div><label>始终朝向相机</label><button onClick={()=>setBillboard(value=>!value)}>{billboard?'已开启':'已关闭'}</button></div>{(['x','y','z']as const).map(axis=><div key={axis}><label>旋转 {axis.toUpperCase()} / °</label><input type="number" step="1" value={rotation[axis]} onChange={event=>setRotation(current=>({...current,[axis]:Number(event.target.value)||0}))}/></div>)}</div></section>
  {activePreset&&groups.map(group=>{const featureKey=SPRITE_ASH_GROUP_FEATURES[group],featureEnabled=featureKey?activePreset[featureKey]:true;return <section className={`group feature-group${featureEnabled?'':' disabled'}`} key={group}><div className="section-head"><strong>{group}</strong>{featureKey&&<label className="feature-toggle"><input type="checkbox" checked={featureEnabled} onChange={event=>updatePreset({...activePreset,[featureKey]:event.target.checked})}/>启用</label>}</div><fieldset disabled={!featureEnabled}><div className="grid2">{SPRITE_ASH_PARAMETER_DEFINITIONS.filter(item=>item.group===group).map(item=><div key={item.key}><label>{item.label}</label>{item.type==='color'?<input type="color" value={String(activePreset[item.key])} onChange={event=>updatePreset({...activePreset,[item.key]:event.target.value})}/>:item.type==='select'?<select value={String(activePreset[item.key])} onChange={event=>updatePreset({...activePreset,[item.key]:event.target.value})}>{item.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input type="number" min={item.min} max={item.max} step={item.step} value={Number(activePreset[item.key])} onChange={event=>updatePreset({...activePreset,[item.key]:Number(event.target.value)})}/>}</div>)}</div></fieldset></section>})}
  <section className="section"><button className="save" onClick={()=>void save()}>保存全部化灰预设</button><div className={`status${isError?' error':''}`}>{message}</div></section>
 </aside><main className="stage"><canvas ref={canvasRef}/><a className="top-link" href="../../index.html">返回调试入口</a><div className="stage-hint">拖动旋转 3D 视角 · 滚轮缩放 · 可手动拖动化灰进度</div></main></div>
};
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
