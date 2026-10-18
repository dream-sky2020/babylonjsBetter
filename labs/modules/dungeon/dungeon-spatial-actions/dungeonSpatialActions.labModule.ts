import { Color3,HemisphericLight,MeshBuilder,StandardMaterial,Vector3,type Mesh } from '@babylonjs/core';
import type { LabModule } from '@/labs/kit';
import { createLabEvent } from '@/labs/kit/labCommunication.types';
import { createSpatialExampleDocument } from '@/core/dungeon-spatial/dungeonSpatialExample';
import { createDungeonRuntime } from '@/core/dungeon-runtime/dungeonRuntime';
import type { DungeonRuntime } from '@/core/dungeon-runtime/dungeonRuntime.types';
import { spatialPresentationPose } from '@/core/dungeon-spatial/dungeonSpatialState';
import type { DungeonPlayerSpawnBinding } from '@/core/dungeon-player-spawn';
import type { DungeonMovementDirection } from '@/core/dungeon-movement';
import { createDungeonRuntimeSaveState,applyDungeonRuntimeSaveState } from '@/core/dungeon-runtime-save/dungeonRuntimeSave';
import type { DungeonRuntimeSaveState } from '@/core/dungeon-runtime-save/dungeonRuntimeSave.types';
import { DUNGEON_TRAVERSAL_STATE_MEMORY,allocateDungeonTraversalStateData,type DungeonTraversalOwnedData } from '../dungeon-traversal/dungeonTraversal.memory';
import { DUNGEON_MOVEMENT_STATE_MEMORY,allocateDungeonMovementStateData,type DungeonMovementOwnedData } from '../dungeon-movement/dungeonMovement.memory';
import { DUNGEON_PLAYER_STATE_MEMORY,DUNGEON_OBSTACLE_STATE_MEMORY,allocateDungeonPlayerStateData,allocateDungeonObstacleStateData,type DungeonPlayerStateData,type DungeonObstacleStateData } from '../dungeon-runtime/dungeonRuntime.memory';

const changed=createLabEvent<{actionId?:string;kind:string;actorId?:string}>('dungeon.spatial-example.changed',1,{label:'空间动作示例',trigger:'动作请求、提交、完成或取消'});
export const dungeonSpatialActionsLabModule: LabModule={
  id:'dungeon-spatial-actions',events:[{definition:changed,publishes:true}],
  manifest:{kind:'system',responsibility:'统一空间世界与多人动作验收',
    core:[{path:'core/dungeon-actions/dungeonActionEngine.ts',symbols:'DungeonActionEngine',purpose:'唯一动作时间轴与组提交'}],
    services:[],protocols:['dungeon.spatial-example.changed'],scheduling:'simulation 推进、presentation 显示、debug 4Hz'},
  setup(context){
    const worldMemory=context.memory.acquire(DUNGEON_TRAVERSAL_STATE_MEMORY),actionsMemory=context.memory.acquire(DUNGEON_MOVEMENT_STATE_MEMORY);
    const playerMemory=context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY),obstacleMemory=context.memory.acquire(DUNGEON_OBSTACLE_STATE_MEMORY);
    const panel=context.ui.addPanel('spatial-example','空间动作验证');
    const scenario=document.createElement('select');
    for(const [value,label] of [['push','推动'],['swap','换位'],['narrow','窄道换位']])scenario.add(new Option(label,value));
    const actor=document.createElement('select');for(const [value,label] of [['$dungeon-player','蓝色角色'],['box','橙色箱子'],['peer','绿色角色']])actor.add(new Option(label,value));
    const status=document.createElement('p'),summary=document.createElement('pre');summary.dataset.spatialSummary='true';
    panel.content.append(scenario,actor,status,summary);
    let runtime: DungeonRuntime,loadId=0,paused=false,saved:DungeonRuntimeSaveState|null=null;
    let off=()=>{};const meshes=new Map<string,Mesh>(),materials:StandardMaterial[]=[];
    const spawn={tilePosition:{x:1,y:2},worldPosition:[1,0,2]} as unknown as DungeonPlayerSpawnBinding;
    const ground=MeshBuilder.CreateGround('spatial-ground',{width:7,height:5},context.scene);ground.position.set(3,-.05,2);
    const light=new HemisphericLight('spatial-light',new Vector3(.3,1,-.5),context.scene);light.intensity=1;
    const groundMaterial=new StandardMaterial('spatial-ground-material',context.scene);groundMaterial.diffuseColor=Color3.FromHexString('#334155');ground.material=groundMaterial;
    context.camera.setTarget(new Vector3(3,0,2));context.camera.radius=10;
    const draw=()=>{
      if(!runtime)return;
      for(const body of runtime.traversal.spatial.bodies.values()){
        const mesh=meshes.get(body.id);if(mesh){const pose=spatialPresentationPose(body);mesh.position.set(pose.x,.3,pose.y);mesh.setEnabled(body.enabled);}
      }
    };
    const reset=()=>{
      off();meshes.forEach(mesh=>mesh.dispose());meshes.clear();materials.splice(0).forEach(m=>m.dispose());
      const doc=createSpatialExampleDocument(scenario.value as 'push'|'swap'|'narrow');
      let world!:DungeonTraversalOwnedData,actions!:DungeonMovementOwnedData,player!:DungeonPlayerStateData,obstacles!:DungeonObstacleStateData;
      const id=++loadId;
      runtime=createDungeonRuntime(doc,spawn,'east',{storage:{
        player:(s,f)=>player=allocateDungeonPlayerStateData(id,'spatial-example',s,f),
        obstacles:bindings=>obstacles=allocateDungeonObstacleStateData(id,'spatial-example',bindings),
        traversal:map=>world=allocateDungeonTraversalStateData(id,'spatial-example',map.topology.tileIds.length),
        movement:w=>actions=allocateDungeonMovementStateData(id,'spatial-example',w.map.topology.tileIds.length,w.map.topology.pointIds.length),
      }});
      runtime.movementResolver.externallyDriven=true;
      worldMemory.replace(world);actionsMemory.replace(actions);playerMemory.replace(player);obstacleMemory.replace(obstacles);
      off=runtime.movementResolver.subscribe(change=>{status.textContent=`${change.kind} · ${change.actorId??''}`;
        void context.communication.publish(changed,{kind:change.kind,actionId:change.requestId,actorId:change.actorId});});
      for(const body of runtime.traversal.spatial.bodies.values()){
        const mesh=MeshBuilder.CreateBox(`body:${body.id}`,{size:body.mobility==='fixed'?.95:.5},context.scene);
        const material=new StandardMaterial(`material:${body.id}`,context.scene);
        material.diffuseColor=Color3.FromHexString(body.id==='$dungeon-player'?'#38bdf8':body.id==='box'?'#fb923c':body.id==='peer'?'#4ade80':'#64748b');
        mesh.material=material;materials.push(material);meshes.set(body.id,mesh);
      }
      status.textContent='蓝色为操控角色，橙色为箱子，绿色为另一角色。';draw();
    };
    const button=(label:string,run:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=run;panel.content.insertBefore(b,summary);};
    for(const [label,direction] of [['↑','north'],['↓','south'],['←','west'],['→','east']] as const)button(label,()=>{
      const result=runtime.movementResolver.requestMove({actorId:actor.value,direction:direction as DungeonMovementDirection,durationSeconds:.6,basePriority:actor.value==='$dungeon-player'?1000:0});
      status.textContent=result.accepted?'开始移动':`拒绝：${result.blockedReason}`;
    });
    button('向右推动',()=>{const r=runtime.movementResolver.requestPush('$dungeon-player','east',1);status.textContent=r.accepted?'接触后推动':`拒绝：${r.reason}`;});
    button('橙绿换位',()=>{const r=runtime.movementResolver.requestSwap('box','peer');status.textContent=r.accepted?'直线换位，轻微错身':`拒绝：${r.reason}`;});
    button('打断协同动作',()=>{for(const g of runtime.movementResolver.storage.groups!.values())if(g.status==='running')runtime.movementResolver.cancelGroup(g.id);});
    button('暂停 / 继续',()=>{paused=!paused;});button('重置',reset);
    button('保存安全快照',()=>{saved=createDungeonRuntimeSaveState('spatial-example',runtime,spawn);status.textContent='已保存整组提交位置，恢复时不保留半个动画。';});
    button('恢复',()=>{const copy=saved;reset();if(copy)applyDungeonRuntimeSaveState(runtime,copy,p=>[p.tileX,0,p.tileY]);draw();});
    scenario.onchange=reset;reset();
    const stop=context.scheduler.register({id:'spatial-simulation',description:'统一动作推进',phase:'simulation',order:100,enabled:()=>!paused,
      run:delta=>runtime.movementResolver.tick(delta)});
    const stopDraw=context.scheduler.register({id:'spatial-presentation',description:'显示连续姿态',phase:'presentation',order:100,run:draw});
    const stopSummary=context.scheduler.register({id:'spatial-summary',description:'可见空间摘要',phase:'debug',order:100,intervalSeconds:.25,
      run:()=>{if(!panel.content.hidden)summary.textContent=JSON.stringify([...runtime.traversal.spatial.bodies.values()].map(b=>({id:b.id,pose:b.pose,committed:b.logicalPosition})),null,2);}});
    return()=>{off();stop();stopDraw();stopSummary();ground.dispose();groundMaterial.dispose();light.dispose();meshes.forEach(mesh=>mesh.dispose());materials.forEach(m=>m.dispose());worldMemory.replace(null);actionsMemory.replace(null);playerMemory.replace(null);obstacleMemory.replace(null);};
  },
};
