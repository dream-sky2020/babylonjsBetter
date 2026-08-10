import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Color3, MeshBuilder, StandardMaterial, TransformNode, type Scene } from '@babylonjs/core';
import { createCameraLabController } from '@/core/camera/cameraLabController.ts';
import { createCameraLabScene } from '@/core/scene/createCameraLabScene.ts';
import { createFloatingCameraControlPanel } from '@/core/ui/FloatingCameraControlPanel.ts';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { MONSTER_CONFIG_URL, MONSTER_STRIPE_PRESET_URL, STRIPE_PRESET_URL, createLayeredMonster, normalizeMonsterConfigLibrary, normalizeMonsterStripePresetLibrary, normalizeStripePresetLibrary, type LayeredMonsterController, type MonsterDisplayConfigLibrary, type MonsterStripePresetLibrary, type StripePresetLibrary } from '@/core/monster';

type MonsterPlacement={id:string;monsterConfigKey:string;monsterStripePresetKey:string;positionMode:'grid'|'center';slots:number;row:number;column:number};
type Battlefield={id:string;name:string;width:number;cellSize:number;rowSpacing:number;monsters:MonsterPlacement[]};
type PlacementPosition={x:number;z:number;row:number;column:number;slots:number};
const STORAGE_KEY='monster-formation-lab:v2';
const OLD_STORAGE_KEY='monster-formation-lab:v1';
const FORMATION_CONFIG_URL='/config/monsterBattlefieldFormations.json';
const FORMATION_API_PATH='/api/monster-battlefield-formations';
const section:React.CSSProperties={padding:12,border:'1px solid #273348',borderRadius:10,background:'#151d29'};
const uid=()=>`monster_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;
const numberOr=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback;
const positiveInt=(value:unknown,fallback=1)=>Math.max(1,Math.round(numberOr(value,fallback)));
const indexInt=(value:unknown,fallback=0)=>Math.max(0,Math.round(numberOr(value,fallback)));
const createBattlefield=(id='battlefield_default'):Battlefield=>({id,name:'默认战场',width:6,cellSize:2.5,rowSpacing:4,monsters:[]});
const normalizeBattlefield=(value:Partial<Battlefield>,fallbackId:string):Battlefield=>({
 id:typeof value.id==='string'&&value.id.trim()?value.id.trim():fallbackId,
 name:typeof value.name==='string'&&value.name.trim()?value.name:'未命名战场',
 width:positiveInt(value.width,6),cellSize:Math.max(.01,numberOr(value.cellSize,2.5)),rowSpacing:Math.max(.01,numberOr(value.rowSpacing,4)),
 monsters:Array.isArray(value.monsters)?value.monsters.map((monster,index)=>({
  id:typeof monster.id==='string'&&monster.id?monster.id:`${fallbackId}_${index}`,
  monsterConfigKey:typeof monster.monsterConfigKey==='string'?monster.monsterConfigKey:'',monsterStripePresetKey:typeof monster.monsterStripePresetKey==='string'?monster.monsterStripePresetKey:'',positionMode:monster.positionMode==='center'?'center':'grid',slots:positiveInt(monster.slots),
  row:indexInt(monster.row),column:indexInt(monster.column,index)
 })):[]
});
export const calculatePlacement=(battlefield:Battlefield,monster:MonsterPlacement):PlacementPosition=>({
 row:monster.row,column:monster.column,slots:monster.slots,
 x:monster.positionMode==='center'?0:(monster.column+monster.slots/2-battlefield.width/2)*battlefield.cellSize,
 z:-monster.row*battlefield.rowSpacing
});
const fetchJson=async(url:string)=>{const response=await fetch(`${url}?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);return response.json()};

const loadFormationLibrary=async():Promise<Record<string,Battlefield>>=>{
 try{
  const response=await requestDevServer(`${FORMATION_API_PATH}?t=${Date.now()}`,{method:'GET'});
  const payload=await response.json();
  if(!response.ok||payload.success===false)throw new Error(payload.message||`HTTP ${response.status}`);
  const data=payload.data&&typeof payload.data==='object'?payload.data:{};
  return Object.fromEntries(Object.entries(data).map(([key,value])=>[key,normalizeBattlefield(value as Partial<Battlefield>,key)]));
 }catch{
  const data=await fetchJson(FORMATION_CONFIG_URL);
  return Object.fromEntries(Object.entries(data&&typeof data==='object'?data:{}).map(([key,value])=>[key,normalizeBattlefield(value as Partial<Battlefield>,key)]));
 }
};
type CommitNumberInputProps={value:number;onCommit:(value:number)=>void;min?:number;step?:number};
const CommitNumberInput:React.FC<CommitNumberInputProps>=({value,onCommit,min,step})=>{
 const [draft,setDraft]=useState(String(value));const editing=useRef(false);
 useEffect(()=>{if(!editing.current)setDraft(String(value))},[value]);
 const commit=()=>{editing.current=false;const parsed=Number(draft);if(draft.trim()!==''&&Number.isFinite(parsed)){onCommit(parsed);setDraft(String(parsed))}else setDraft(String(value))};
 return <input type="number" min={min} step={step} value={draft} onFocus={()=>{editing.current=true}} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();else if(event.key==='Escape'){setDraft(String(value));event.currentTarget.blur()}}}/>;
};

const App:React.FC=()=>{
 const canvasRef=useRef<HTMLCanvasElement>(null),stageRef=useRef<HTMLElement>(null),sceneRef=useRef<Scene|null>(null),renderedRef=useRef<Map<string,LayeredMonsterController>>(new Map()),gridRef=useRef<TransformNode|null>(null);
 const [configs,setConfigs]=useState<MonsterDisplayConfigLibrary>({}),[monsterStripes,setMonsterStripes]=useState<MonsterStripePresetLibrary>({}),[stripes,setStripes]=useState<StripePresetLibrary>({});
 const [battlefields,setBattlefields]=useState<Record<string,Battlefield>>(()=>{try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY)||'{}');return Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,normalizeBattlefield(value as Partial<Battlefield>,key)]))}catch{return {}}});
 const [activeId,setActiveId]=useState(''),[selectedId,setSelectedId]=useState(''),[message,setMessage]=useState('正在加载怪物视觉配置…');
 const battlefield=battlefields[activeId],selected=battlefield?.monsters.find(monster=>monster.id===selectedId);
 const positions=useMemo(()=>battlefield?battlefield.monsters.map(monster=>calculatePlacement(battlefield,monster)):[],[battlefield]);
 useEffect(()=>{Promise.all([fetchJson(MONSTER_CONFIG_URL),fetchJson(MONSTER_STRIPE_PRESET_URL),fetchJson(STRIPE_PRESET_URL),loadFormationLibrary()]).then(([rawConfigs,rawMonsterStripes,rawStripes,savedBattlefields])=>{
  const library=normalizeMonsterConfigLibrary(rawConfigs);setConfigs(library);setMonsterStripes(normalizeMonsterStripePresetLibrary(rawMonsterStripes));setStripes(normalizeStripePresetLibrary(rawStripes));
  setBattlefields(current=>{if(Object.keys(savedBattlefields).length)return Object.fromEntries(Object.entries(savedBattlefields).map(([id,battlefield])=>[id,{...battlefield,monsters:battlefield.monsters.map(monster=>({...monster,monsterStripePresetKey:monster.monsterStripePresetKey||library[monster.monsterConfigKey]?.monsterStripePresetKey||''}))}]));if(Object.keys(current).length)return current;const next=createBattlefield(),keys=Object.keys(library);next.monsters=keys.slice(0,3).map((key,index)=>({id:uid(),monsterConfigKey:key,monsterStripePresetKey:library[key]?.monsterStripePresetKey||'',positionMode:'grid',slots:1,row:index,column:index}));return{[next.id]:next}});
  setMessage(`已加载 ${Object.keys(library).length} 个怪物视觉配置和 ${Object.keys(savedBattlefields).length} 个服务器战场配置。`);
 }).catch(error=>setMessage(`加载失败：${String(error)}`))},[]);
 useEffect(()=>{if(!activeId||!battlefields[activeId])setActiveId(Object.keys(battlefields)[0]||'')},[battlefields,activeId]);
 useEffect(()=>{if(battlefield&&!battlefield.monsters.some(monster=>monster.id===selectedId))setSelectedId(battlefield.monsters[0]?.id||'')},[battlefield,selectedId]);
 useEffect(()=>{
  const canvas=canvasRef.current,stage=stageRef.current;if(!canvas||!stage)return;
  const context=createCameraLabScene(canvas);sceneRef.current=context.scene;context.camera.target.set(0,-1,-8);context.camera.radius=34;
  const camera=createCameraLabController(context.camera),panel=createFloatingCameraControlPanel(stage,camera);gridRef.current=new TransformNode('formationGrid',context.scene);
  const drag={active:false,pointerId:-1,x:0,y:0};
  const pointerDown=(event:PointerEvent)=>{if(event.button!==0)return;if(camera.state.lookControlMode==='pointerLock'){canvas.requestPointerLock?.().catch?.(()=>{});return}drag.active=true;drag.pointerId=event.pointerId;drag.x=event.clientX;drag.y=event.clientY;canvas.style.cursor='grabbing';canvas.setPointerCapture(event.pointerId)};
  const pointerMove=(event:PointerEvent)=>{if(!drag.active||event.pointerId!==drag.pointerId)return;camera.handlePointerDelta(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;panel.syncFromController()};
  const pointerEnd=(event:PointerEvent)=>{if(!drag.active||event.pointerId!==drag.pointerId)return;drag.active=false;drag.pointerId=-1;canvas.style.cursor='grab';if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId)};
  const lockedMove=(event:MouseEvent)=>{if(document.pointerLockElement===canvas)camera.handlePointerDelta(event.movementX||0,event.movementY||0)};
  const lockChange=()=>{canvas.style.cursor=document.pointerLockElement===canvas?'none':'grab'};
  const keyDown=(event:KeyboardEvent)=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement||event.target instanceof HTMLTextAreaElement||!['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE'].includes(event.code))return;camera.keys.add(event.code);event.preventDefault()};
  const keyUp=(event:KeyboardEvent)=>camera.keys.delete(event.code);
  const wheel=(event:WheelEvent)=>{if(camera.state.mode!=='orbit')return;event.preventDefault();camera.handleWheel(event.deltaY);panel.syncFromController()};
  const resize=()=>context.engine.resize();canvas.style.cursor='grab';
  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);canvas.addEventListener('wheel',wheel,{passive:false});document.addEventListener('mousemove',lockedMove);document.addEventListener('pointerlockchange',lockChange);window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('resize',resize);
  let time=0;context.engine.runRenderLoop(()=>{const dt=context.engine.getDeltaTime()/1000;time+=dt;camera.update(dt);panel.updateStatus();renderedRef.current.forEach(monster=>monster.updateTime(time));context.scene.render()});
  return()=>{canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerEnd);canvas.removeEventListener('pointercancel',pointerEnd);canvas.removeEventListener('wheel',wheel);document.removeEventListener('mousemove',lockedMove);document.removeEventListener('pointerlockchange',lockChange);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('resize',resize);renderedRef.current.forEach(monster=>monster.dispose());renderedRef.current.clear();panel.dispose();context.dispose();sceneRef.current=null};
 },[]);
 useEffect(()=>{
  const scene=sceneRef.current;if(!scene||!battlefield)return;
  renderedRef.current.forEach(monster=>monster.dispose());renderedRef.current.clear();gridRef.current?.getChildMeshes().forEach(mesh=>mesh.dispose());
  const gridMaterial=new StandardMaterial(`placementGrid_${Date.now()}`,scene);gridMaterial.diffuseColor=new Color3(.12,.45,.68);gridMaterial.emissiveColor=new Color3(.03,.15,.24);gridMaterial.alpha=.34;
  const rowCount=Math.max(1,...battlefield.monsters.map(monster=>monster.row+1));
  for(let row=0;row<rowCount;row++)for(let column=0;column<battlefield.width;column++){const cell=MeshBuilder.CreateBox(`cell_${row}_${column}`,{width:battlefield.cellSize-.08,depth:Math.min(battlefield.cellSize,battlefield.rowSpacing)-.08,height:.035},scene);cell.position.set((column+.5-battlefield.width/2)*battlefield.cellSize,-2.105,-row*battlefield.rowSpacing);cell.material=gridMaterial;cell.parent=gridRef.current;cell.isPickable=false}
  battlefield.monsters.forEach((item,index)=>{const config=configs[item.monsterConfigKey],position=positions[index];if(!config||!position)return;const monster=createLayeredMonster(scene,`placement_${item.id}`);monster.load(config,monsterStripes[item.monsterStripePresetKey||config.monsterStripePresetKey]??null,stripes);monster.root.position.addInPlaceFromFloats(position.x,0,position.z);renderedRef.current.set(item.id,monster);const marker=MeshBuilder.CreateBox(`marker_${item.id}`,{width:item.positionMode==='center'?Math.max(.2,battlefield.cellSize-.12):Math.max(.2,item.slots*battlefield.cellSize-.12),depth:.14,height:.08},scene);marker.position.set(position.x,-2.03,position.z);const material=new StandardMaterial(`markerMaterial_${item.id}`,scene);material.diffuseColor=item.positionMode==='center'?new Color3(1,.42,.08):item.id===selectedId?new Color3(.2,1,.65):new Color3(.2,.65,1);material.emissiveColor=material.diffuseColor.scale(.5);material.alpha=.72;marker.material=material;marker.parent=gridRef.current});
 },[battlefield,positions,configs,monsterStripes,stripes,selectedId]);
 const patchBattlefield=(patch:Partial<Battlefield>)=>battlefield&&setBattlefields(all=>({...all,[battlefield.id]:{...battlefield,...patch}}));
 const patchMonster=(patch:Partial<MonsterPlacement>)=>selected&&patchBattlefield({monsters:battlefield.monsters.map(monster=>monster.id===selected.id?{...monster,...patch}:monster)});
 const addMonster=()=>{const key=Object.keys(configs)[0];if(!battlefield||!key)return;const monster:MonsterPlacement={id:uid(),monsterConfigKey:key,monsterStripePresetKey:configs[key]?.monsterStripePresetKey||'',positionMode:'grid',slots:1,row:0,column:0};patchBattlefield({monsters:[...battlefield.monsters,monster]});setSelectedId(monster.id)};
 const createConfig=()=>{let id=`battlefield_${Date.now().toString(36)}`;while(battlefields[id])id=`${id}_copy`;const next=createBattlefield(id);setBattlefields(all=>({...all,[id]:next}));setActiveId(id);setSelectedId('')};
 const deleteConfig=()=>{if(!battlefield||Object.keys(battlefields).length<=1)return;const next={...battlefields};delete next[battlefield.id];setBattlefields(next);setActiveId(Object.keys(next)[0]||'')};
 const changeBattlefieldId=(nextValue:string)=>{if(!battlefield)return;const nextId=nextValue.trim();if(!nextId||nextId===battlefield.id)return;if(battlefields[nextId]){setMessage(`ID ${nextId} 已存在。`);return}const next={...battlefields};delete next[battlefield.id];next[nextId]={...battlefield,id:nextId};setBattlefields(next);setActiveId(nextId)};
 const save=async()=>{try{const response=await requestDevServer(FORMATION_API_PATH,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(battlefields)});const payload=await response.json();if(!response.ok||payload.success===false)throw new Error(payload.errors?.[0]||payload.message||`HTTP ${response.status}`);localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(OLD_STORAGE_KEY);setMessage(`已保存 ${Object.keys(battlefields).length} 个战场配置到 config/monsterBattlefieldFormations.json。`)}catch(error){setMessage(`保存失败：${String(error)}`)}};
 return <div style={{height:'100vh',padding:14,display:'grid',gridTemplateColumns:'410px minmax(0,1fr)',gap:14}}>
  <aside style={{overflow:'auto',display:'flex',flexDirection:'column',gap:12}}><div><h2 style={{margin:'0 0 5px'}}>怪物战场位置 Lab</h2><div style={{color:'#8291a8',fontSize:12}}>直接指定行、列；允许多个怪物占据相同位置，不进行占格冲突或自动换行计算。</div></div>
  <section style={section}><label>战场配置</label><select value={activeId} onChange={event=>setActiveId(event.target.value)}>{Object.values(battlefields).map(item=><option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:8}}><button onClick={createConfig}>新建战场</button><button disabled={Object.keys(battlefields).length<=1} onClick={deleteConfig}>删除战场</button></div>{battlefield&&<><label>名称</label><input value={battlefield.name} onChange={event=>patchBattlefield({name:event.target.value})}/><label>ID（失去焦点或 Enter 应用）</label><input defaultValue={battlefield.id} key={battlefield.id} onBlur={event=>changeBattlefieldId(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur()}}/><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7}}><div><label>战场宽度/格</label><CommitNumberInput min={1} step={1} value={battlefield.width} onCommit={value=>patchBattlefield({width:positiveInt(value)})}/></div><div><label>格子宽度</label><CommitNumberInput min={.01} step={.1} value={battlefield.cellSize} onCommit={value=>patchBattlefield({cellSize:Math.max(.01,value)})}/></div><div><label>前后间距</label><CommitNumberInput min={.01} step={.1} value={battlefield.rowSpacing} onCommit={value=>patchBattlefield({rowSpacing:Math.max(.01,value)})}/></div></div></>}</section>
  <section style={section}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><strong>怪物列表</strong><button onClick={addMonster}>＋ 添加怪物</button></div><div style={{display:'flex',flexDirection:'column',gap:6,marginTop:9}}>{battlefield?.monsters.map((item,index)=><button key={item.id} onClick={()=>setSelectedId(item.id)} style={{textAlign:'left',borderColor:item.id===selectedId?'#65a8ff':'#3a4961',background:item.id===selectedId?'#183b61':'#202b3d'}}>{index+1}. {configs[item.monsterConfigKey]?.name||item.monsterConfigKey} · 第 {item.row+1} 行 · {item.positionMode==='center'?'绝对居中':`第 ${item.column+1} 列 / ${item.slots} 格`}</button>)}</div></section>
  {selected&&<section style={section}><label>怪物视觉配置</label><select value={selected.monsterConfigKey} onChange={event=>{const key=event.target.value;patchMonster({monsterConfigKey:key,monsterStripePresetKey:configs[key]?.monsterStripePresetKey||''})}}>{Object.entries(configs).map(([key,config])=><option key={key} value={key}>{config.name} · {key}</option>)}</select><label>怪物条纹预设</label><select value={selected.monsterStripePresetKey||configs[selected.monsterConfigKey]?.monsterStripePresetKey||''} onChange={event=>patchMonster({monsterStripePresetKey:event.target.value})}>{Object.entries(monsterStripes).map(([key,preset])=><option key={key} value={key}>{preset.name} · {key}</option>)}</select><label>位置模式</label><select value={selected.positionMode} onChange={event=>patchMonster({positionMode:event.target.value==='center'?'center':'grid'})}><option value="grid">格子定位</option><option value="center">绝对居中</option></select><label>所在行（从 1 开始）</label><CommitNumberInput min={1} step={1} value={selected.row+1} onCommit={value=>patchMonster({row:indexInt(value-1)})}/>{selected.positionMode==='grid'&&<><label>占用格数</label><CommitNumberInput min={1} step={1} value={selected.slots} onCommit={value=>patchMonster({slots:positiveInt(value)})}/><label>所在列（从 1 开始）</label><CommitNumberInput min={1} step={1} value={selected.column+1} onCommit={value=>patchMonster({column:indexInt(value-1)})}/></>}<button style={{width:'100%',marginTop:10}} onClick={()=>patchBattlefield({monsters:battlefield.monsters.filter(monster=>monster.id!==selected.id)})}>删除此怪物</button></section>}
  <section style={section}><button style={{width:'100%'}} onClick={()=>void save()}>保存到服务器配置</button><div style={{marginTop:8,color:'#9dacbf',fontSize:12,lineHeight:1.5}}>{message}</div></section></aside>
  <main ref={stageRef} style={{minWidth:0,position:'relative',border:'1px solid #273348',borderRadius:12,overflow:'hidden',background:'#080d14'}}><canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block'}}/><div style={{position:'absolute',left:12,bottom:10,color:'#c1cede',fontSize:12,pointerEvents:'none'}}>位置由行、列直接决定 · 占位允许重叠 · 不自动换行</div></main>
 </div>;
};
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);