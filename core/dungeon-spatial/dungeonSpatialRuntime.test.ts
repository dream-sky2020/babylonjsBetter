import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import { createDungeonRuntimeSaveState,applyDungeonRuntimeSaveState } from '../dungeon-runtime-save/dungeonRuntimeSave.ts';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { indexSpatialBody,sweepSpatialBody } from './dungeonSpatialGeometry.ts';
import { spatialPresentationPose } from './dungeonSpatialState.ts';
import { createSpatialExampleDocument } from './dungeonSpatialExample.ts';
import { DungeonMapDocumentStore } from '../map-document/dungeonMapDocument.store.ts';
import { componentDefinition as bodyComponent } from '../entity/components/spatial-body.component.ts';
import { componentDefinition as colliderComponent } from '../entity/components/spatial-collider.component.ts';
import { compileSpatialDefinitions } from './dungeonSpatialDefinition.ts';
import { encodeDungeonMapDocumentV3, parseDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { startDungeonPlayerTurn, inspectDungeonPlayerMovement, updateDungeonPlayerMovement } from '../dungeon-player-movement/dungeonPlayerMovement.ts';

export function spatialFixture(width=7,height=5) {
  const doc=migrateDungeonMapToDocumentV2({presetKey:'spatial-test',name:'空间动作',map:createDungeonMapData({id:'spatial-test',width,height})}).document;
  for(const [id,x,y,pushable] of [['box',2,2,true],['peer',3,2,false]] as const) {
    doc.entities.push({id,entityType:'spatial-object',name:id});
    (doc.components['spatial-attachment']??=[]).push({id:id+':attachment',entityId:id,type:'spatial-attachment',version:1,targets:[{kind:'tile',tileId:doc.grid.tileIds[y*width+x]}]});
    (doc.components['spatial-body']??=[]).push({id:id+':body',entityId:id,type:'spatial-body',version:1,activeByDefault:true,mobility:'movable',pushable,initialFacing:'east',movementProfileId:'ground'});
    (doc.components['spatial-collider']??=[]).push({id:id+':collider',entityId:id,type:'spatial-collider',version:1,response:'block',footprint:'center',shape:'disc',radius:.25,halfWidth:.5,halfHeight:.5,offsetX:0,offsetY:0});
  }
  const spawn={tilePosition:{x:1,y:2},worldPosition:[1,0,2]} as unknown as DungeonPlayerSpawnBinding;
  const runtime=createDungeonRuntime(doc,spawn,'east');runtime.movementResolver.externallyDriven=true;
  return {doc,runtime,spawn,engine:runtime.movementResolver,world:runtime.traversal};
}

test('new map, editable multi-collider data and runtime share one spatial record and identity',()=>{
  const {doc,world,runtime}=spatialFixture();
  const box=world.body('box')!;assert.equal(world.spatial.bodies.get('box:body'),box);assert.equal(world.actors.get('box'),box);
  runtime.obstacleStates.set('box',false);assert.equal(box.enabled,false);assert.equal(world.inspectStep('$dungeon-player',15,'east').blockedReason,undefined);
  runtime.obstacleStates.set('box',true);assert.equal(world.inspectStep('$dungeon-player',15,'east').blockedReason,'movement-obstacle');
  assert.equal(doc.components['movement-obstacle'],undefined);
});

test('push reserves both participants, updates continuous poses and commits the whole set before observers',()=>{
  const {world,engine}=spatialFixture();world.body('peer')!.enabled=false;
  const box=world.body('box')!,player=world.body('$dungeon-player')!;
  let observations=0;const off=world.subscribe(c=>{if(c.kind==='actor-moved'){observations++;assert.equal(player.tileIndex,16);assert.equal(box.tileIndex,17);}});
  const result=engine.requestPush(player.id,'east',1);assert.equal(result.accepted,true);
  assert.equal(engine.requestMove({actorId:'peer',direction:'west',durationSeconds:1}).accepted,false);
  engine.tick(.1);assert.equal(box.pose.x,2);assert.ok(player.pose.x>1);assert.equal(player.tileIndex,15);
  engine.tick(.4);assert.equal(observations,2);assert.equal(player.tileIndex,16);assert.equal(box.tileIndex,17);
  engine.tick(.5);assert.equal(player.pose.x,2);assert.equal(box.pose.x,3);
  assert.equal(engine.storage.groups!.get(result.actionId!)!.status,'completed');off();
});

test('swap crosses directly with a small cosmetic sidestep and commits both anchors only at completion',()=>{
  const {world,engine}=spatialFixture();
  const a=world.body('box')!,b=world.body('peer')!;
  const result=engine.requestSwap(a.id,b.id,1);assert.equal(result.accepted,true);
  let commits=0;world.subscribe(change=>{if(change.kind==='actor-moved'){commits++;assert.equal(a.tileIndex,17);assert.equal(b.tileIndex,16);}});
  engine.tick(.25);assert.equal(a.pose.y,2);assert.equal(b.pose.y,2);assert.ok(a.pose.x>2);assert.ok(b.pose.x<3);
  assert.ok(spatialPresentationPose(a).y>2);assert.ok(spatialPresentationPose(b).y<2);
  assert.ok(Math.abs(spatialPresentationPose(a).y-2)<=.12);assert.equal(a.tileIndex,16);
  engine.tick(.25);assert.equal(a.pose.x,2.5);assert.equal(b.pose.x,2.5);assert.equal(a.tileIndex,16);assert.equal(b.tileIndex,17);assert.equal(commits,0);
  engine.tick(.5);assert.deepEqual(a.pose,{x:3,y:2});assert.deepEqual(b.pose,{x:2,y:2});
  assert.equal(a.tileIndex,17);assert.equal(b.tileIndex,16);assert.equal(commits,2);assert.equal(a.presentationOffset,undefined);
});

test('single-tile corridor permits swap; tight walls reduce cosmetic sidestep to zero without changing colliders',()=>{
  const doc=createSpatialExampleDocument('narrow');
  for(const collider of doc.components['spatial-collider']??[])if(collider.entityId.startsWith('wall:'))collider.halfHeight=.74;
  const spawn={tilePosition:{x:1,y:2},worldPosition:[1,0,2]} as unknown as DungeonPlayerSpawnBinding;
  const runtime=createDungeonRuntime(doc,spawn),engine=runtime.movementResolver;
  const result=engine.requestSwap('box','peer',1);assert.equal(result.accepted,true);
  assert.deepEqual(engine.storage.groups!.get(result.actionId!)!.cells,[16,17]);
  engine.tick(.5);
  for(const id of ['box','peer']) {
    const body=runtime.traversal.body(id)!;assert.equal(body.pose.y,2);assert.equal(spatialPresentationPose(body).y,2);
    assert.equal(body.blocksMovement,true);assert.equal(body.tileIndex,id==='box'?16:17);
  }
  engine.tick(.5);assert.equal(runtime.traversal.body('box')!.tileIndex,17);
});

test('2D zero-offset swap stays straight and its two cells reject third-party entry',()=>{
  const {engine,world}=spatialFixture();engine.swapPresentationOffset=0;
  world.registerActor({id:'third',kind:'dynamic',tileIndex:9,enabled:true,blocksMovement:true,movementProfileId:'ground'});
  assert.equal(engine.requestSwap('box','peer').accepted,true);
  assert.equal(engine.requestMove({actorId:'third',direction:'south',durationSeconds:1,ignoreDynamicOccupancy:true,checkStaticObstacles:false}).blockedReason,'reservation-conflict');
  engine.tick(.125);assert.equal(spatialPresentationPose(world.body('box')!).y,2);assert.equal(world.body('box')!.tileIndex,16);
  engine.tick(.125);assert.equal(world.body('box')!.tileIndex,17);
});

test('a boundary between neighbours prevents a direct swap',()=>{
  const {doc,spawn}=spatialFixture();const store=new DungeonMapDocumentStore(doc);
  const side=doc.grid.sides.find(row=>row.tileId===doc.grid.tileIds[16]&&row.direction==='east')!;
  store.addEntityAt({kind:'side',sideId:side.id},{id:'wall-between',entityType:'obstacle',components:[bodyComponent.createDefault(),colliderComponent.createDefault()]});
  const runtime=createDungeonRuntime(store.getDocument(),spawn);
  const result=runtime.movementResolver.requestSwap('box','peer');
  assert.equal(result.accepted,false);assert.ok(result.blockingEntityIds.includes('wall-between'));
  assert.equal(runtime.traversal.body('box')!.tileIndex,16);
});

test('group participants cannot start independent moves or turns before the group finishes',()=>{
  const {engine,world,runtime}=spatialFixture();world.body('peer')!.enabled=false;
  assert.equal(engine.requestPush('$dungeon-player','east',1).accepted,true);
  assert.equal(engine.hasActiveRequests,true);assert.equal(engine.isBusy('box'),true);
  assert.equal(startDungeonPlayerTurn(runtime,'left').blockedReason,'movement-in-progress');
  assert.equal(inspectDungeonPlayerMovement(runtime,'south').blockedReason,'movement-in-progress');
  assert.equal(engine.requestMove({actorId:'box',direction:'south',durationSeconds:1}).blockedReason,'movement-in-progress');
  engine.tick(1);assert.equal(engine.hasActiveRequests,false);assert.equal(runtime.playerMovement,null);
});

test('push reaches collider contact before the box moves and emits contact exactly once',()=>{
  const {engine,world}=spatialFixture();world.body('peer')!.enabled=false;
  let contacts=0;engine.subscribe(change=>{if(change.kind==='contact'&&change.actorId==='box')contacts++;});
  engine.requestPush('$dungeon-player','east',1);engine.tick(.2);
  assert.equal(world.body('box')!.pose.x,2);
  assert.equal(world.body('$dungeon-player')!.pose.x,1.5);
  engine.tick(.3);assert.equal(world.body('box')!.pose.x,2.5);
  assert.equal(world.body('$dungeon-player')!.pose.x,2);
  engine.tick(.5);assert.equal(contacts,1);
});

test('large frame processes completion rules before a continued intent uses the remaining time',()=>{
  const {engine,world}=spatialFixture();world.body('box')!.enabled=false;world.body('peer')!.enabled=false;
  const seen:string[]=[];let steps=0;
  const start=()=>engine.requestMove({actorId:'$dungeon-player',direction:'east',durationSeconds:.5});
  start();engine.tick(1.25,()=>{
    if(engine.samples.get('$dungeon-player')?.completed){seen.push(`rule:${++steps}`);if(steps<3){seen.push('continue');start();}}
  });
  assert.deepEqual(seen,['rule:1','continue','rule:2','continue']);
  assert.equal(world.body('$dungeon-player')!.tileIndex,18);
  assert.equal(engine.getActiveRequest('$dungeon-player')!.elapsedSeconds,.25);
  assert.equal(world.body('$dungeon-player')!.pose.x,3.5);
});

test('pause prevents both initial projection and continuation after a completed cooperative action',()=>{
  const {engine}=spatialFixture();let projects=0,ready=false;
  engine.tick(1,()=>projects++,()=>ready);assert.equal(projects,0);assert.equal(engine.storage.simulationSeconds,0);
  ready=true;engine.requestSwap('box','peer',1);
  engine.subscribeGroupCompleted(()=>{ready=false;});
  engine.tick(2,()=>projects++,()=>ready);
  assert.equal(engine.storage.simulationSeconds,1);assert.equal(projects,2);
});

test('zero-duration requests complete once and loop seam poses use the neighbouring periodic image',()=>{
  const doc=migrateDungeonMapToDocumentV2({presetKey:'loop',name:'loop',map:createDungeonMapData({id:'loop',width:7,height:5,mode:'loop-horizontal'})}).document;
  const runtime=createDungeonRuntime(doc,{tilePosition:{x:6,y:2},worldPosition:[6,0,2]} as unknown as DungeonPlayerSpawnBinding,'east');
  const engine=runtime.movementResolver;engine.externallyDriven=true;let completed=0;
  engine.subscribe(change=>{if(change.kind==='completed')completed++;});
  engine.requestMove({actorId:'$dungeon-player',direction:'east',durationSeconds:1});engine.tick(.5);
  assert.equal(runtime.traversal.body('$dungeon-player')!.pose.x,6.5);
  engine.tick(.5);assert.equal(runtime.playerPosition.tileX,0);assert.equal(runtime.traversal.body('$dungeon-player')!.pose.x,0);
  engine.requestMove({actorId:'$dungeon-player',direction:'east',durationSeconds:0});engine.tick(0);engine.tick(.1);
  assert.equal(completed,2);assert.equal(runtime.playerPosition.tileX,1);
});

test('rotation completion splits a large frame before a new physical intent begins',()=>{
  const {engine,runtime,world}=spatialFixture();world.body('box')!.enabled=false;world.body('peer')!.enabled=false;
  startDungeonPlayerTurn(runtime,'left',{turnTimingMode:'seconds-per-turn',turnSecondsPerAction:.25});
  let began=false;
  engine.tick(.5,delta=>{
    const result=updateDungeonPlayerMovement(runtime,delta);
    if(result.completed&&!began){began=true;engine.requestMove({actorId:'$dungeon-player',direction:'east',durationSeconds:1});}
  });
  assert.equal(began,true);assert.equal(engine.getActiveRequest('$dungeon-player')!.elapsedSeconds,.25);
  assert.equal(world.body('$dungeon-player')!.pose.x,1.25);
});

test('third-party geometry on the direct path rejects a swap without changing any position',()=>{
  const {world,engine}=spatialFixture();const b=world.body('$dungeon-player')!;
  b.pose={x:2.5,y:2};indexSpatialBody(world.spatial,b);
  const result=engine.requestSwap('box','peer');assert.equal(result.accepted,false);assert.equal(result.reason,'trajectory-blocked');
  assert.deepEqual(world.body('box')!.pose,{x:2,y:2});assert.equal(engine.storage.groups!.size,0);
});

test('new third-party geometry interrupts a running swap and recovery clears the cosmetic pose',()=>{
  const {engine,world}=spatialFixture();const result=engine.requestSwap('box','peer',1);assert.equal(result.accepted,true);
  engine.tick(.1);
  world.registerActor({id:'intruder',kind:'dynamic',tileIndex:10,enabled:true,blocksMovement:true,movementProfileId:'ground'});
  const intruder=world.body('intruder')!;world.spatial.colliders.get(intruder.colliderIds[0])!.radius=.1;
  intruder.pose={x:2.5,y:2};indexSpatialBody(world.spatial,intruder);
  engine.tick(.4);assert.equal(engine.storage.groups!.get(result.actionId!)!.recovering,true);
  engine.tick(.25);assert.equal(engine.storage.groups!.get(result.actionId!)!.status,'cancelled');
  assert.equal(world.body('box')!.tileIndex,16);assert.equal(world.body('peer')!.tileIndex,17);
  assert.equal(world.body('box')!.presentationOffset,undefined);
});

test('swap cancellation at any in-flight point returns continuously to original anchors and clears cosmetic offsets',()=>{
  for(const elapsed of [.1,.7]){
    const {engine,world}=spatialFixture();const result=engine.requestSwap('box','peer',1);assert.equal(result.accepted,true);
    engine.tick(elapsed);const before={...world.body('box')!.pose};engine.cancelGroup(result.actionId!);
    const visualBefore=spatialPresentationPose(world.body('box')!);engine.tick(0);
    assert.deepEqual(spatialPresentationPose(world.body('box')!),visualBefore);
    assert.deepEqual(world.body('box')!.pose,before);engine.tick(.25);
    assert.equal(world.body('box')!.tileIndex,16);
    assert.deepEqual(world.body('box')!.pose,{x:2,y:2});assert.equal(world.body('box')!.presentationOffset,undefined);
    assert.equal(engine.storage.groups!.get(result.actionId!)!.status,'cancelled');
    assert.equal(engine.storage.groups!.get(result.actionId!)!.committed,false);
  }
});

test('winner waits for rollback geometry and the engine advances every actor once per boundary',()=>{
  const {engine,world}=spatialFixture();world.body('box')!.enabled=false;world.body('peer')!.enabled=false;
  world.registerActor({id:'rival',kind:'dynamic',tileIndex:17,enabled:true,blocksMovement:true,movementProfileId:'ground'});
  engine.requestMove({actorId:'$dungeon-player',direction:'east',durationSeconds:1,basePriority:0});engine.tick(.2);
  engine.requestMove({actorId:'rival',direction:'west',durationSeconds:1,basePriority:2000});
  engine.tick(.1,dt=>{engine.advanceActor('rival',dt);engine.advanceActor('rival',dt);});
  assert.equal(engine.getActiveRequest('rival')!.elapsedSeconds,0);
  assert.ok(world.body('$dungeon-player')!.pose.x<1.2);
  engine.tick(.2);assert.ok(engine.getActiveRequest('rival')!.elapsedSeconds>0);
});

test('safe v2 snapshot restores a whole mid-swap to committed anchors and accepts old v1 saves',()=>{
  const {engine,runtime,spawn}=spatialFixture();engine.requestSwap('box','peer',1);engine.tick(.6);
  runtime.traversal.body('peer')!.facing='north-east';
  const saved=createDungeonRuntimeSaveState('spatial-test',runtime,spawn)!;assert.equal(saved.version,2);
  const fresh=spatialFixture();applyDungeonRuntimeSaveState(fresh.runtime,saved,p=>[p.tileX,0,p.tileY]);
  assert.equal(fresh.world.body('box')!.tileIndex,16);assert.deepEqual(fresh.world.body('box')!.pose,{x:2,y:2});
  assert.equal(fresh.world.body('peer')!.tileIndex,17);assert.equal(fresh.engine.storage.groups!.size,0);
  assert.equal(fresh.world.body('peer')!.presentationOffset,undefined);
  assert.equal(fresh.world.body('peer')!.facing,'north-east');
  assert.doesNotThrow(()=>applyDungeonRuntimeSaveState(fresh.runtime,{version:1,dungeonPresetKey:'spatial-test',playerFacing:'north'},p=>[p.tileX,0,p.tileY]));
});

test('swept geometry catches a thin third-party collider between endpoints',()=>{
  const {world}=spatialFixture();const player=world.body('$dungeon-player')!,box=world.body('box')!;
  box.pose={x:2.2,y:2};indexSpatialBody(world.spatial,box);
  assert.deepEqual(sweepSpatialBody(world.spatial,player,{x:1,y:2},{x:3,y:2}),['box','peer']);
});

test('restore validates player and other bodies together and clears in-flight tracks',()=>{
  const {engine,runtime,spawn}=spatialFixture();
  assert.equal(engine.requestSwap('$dungeon-player','box',1).accepted,true);engine.tick(1);
  const saved=createDungeonRuntimeSaveState('spatial-test',runtime,spawn)!;
  const fresh=spatialFixture();fresh.engine.requestSwap('box','peer',1);fresh.engine.tick(.2);
  const result=applyDungeonRuntimeSaveState(fresh.runtime,saved,p=>[p.tileX,0,p.tileY]);
  assert.deepEqual(result.warnings,[]);assert.equal(fresh.world.body('box')!.tileIndex,15);
  assert.equal(fresh.runtime.playerPosition.tileX,2);assert.equal(fresh.engine.hasActiveRequests,false);
  assert.equal(fresh.engine.storage.groups!.size,0);
  fresh.engine.tick(1);assert.equal(fresh.world.body('box')!.tileIndex,15);
  const corrupt=structuredClone(saved);corrupt.bodies![0].tileX=corrupt.playerPosition!.tileX;
  const clean=spatialFixture();const rejected=applyDungeonRuntimeSaveState(clean.runtime,corrupt,p=>[p.tileX,0,p.tileY]);
  assert.ok(rejected.warnings.length);assert.equal(clean.runtime.playerPosition.tileX,1);
  assert.equal(clean.world.body('box')!.tileIndex,16);
});

test('editor creates a boundary body, moves a tile body, and preserves identities through undo, redo and storage',()=>{
  const {doc}=spatialFixture();const store=new DungeonMapDocumentStore(doc);
  const entity={id:'door',entityType:'obstacle',components:[bodyComponent.createDefault(),colliderComponent.createDefault()]};
  store.addEntityAt({kind:'side',sideId:doc.grid.sides[0].id},entity);
  let definitions=compileSpatialDefinitions(store.getDocument());assert.deepEqual(definitions.issues,[]);
  assert.equal(definitions.bodies.find(b=>b.entityId==='door')!.colliders[0].shape,'boundary');
  store.undo();assert.equal(store.getDocument().entities.some(e=>e.id==='door'),false);store.redo();
  assert.equal(store.getDocument().entities.some(e=>e.id==='door'),true);
  const original={kind:'tile' as const,tileId:doc.grid.tileIds[16]},target={kind:'tile' as const,tileId:doc.grid.tileIds[23]};
  store.moveEntity('box',original,target);
  assert.deepEqual(compileSpatialDefinitions(store.getDocument()).bodies.find(b=>b.entityId==='box')!.anchor,target);
  const packed=encodeDungeonMapDocumentV3(store.getDocument()),restored=parseDungeonMapDocumentV3(packed);
  assert.equal(compileSpatialDefinitions(restored).bodies.find(b=>b.entityId==='box')!.id,'box:body');
});
