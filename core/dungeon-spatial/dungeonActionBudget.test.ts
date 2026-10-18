import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { createDungeonRuntimeSaveState,applyDungeonRuntimeSaveState } from '../dungeon-runtime-save/dungeonRuntimeSave.ts';
import { createSpatialExampleDocument } from './dungeonSpatialExample.ts';
import { indexSpatialBody } from './dungeonSpatialGeometry.ts';

function fixture(duration=.25) {
  const doc=migrateDungeonMapToDocumentV2({presetKey:'budget',name:'budget',map:createDungeonMapData({id:'budget',width:6,height:1})}).document;
  const spawn={tilePosition:{x:1,y:0},worldPosition:[1,0,0]} as unknown as DungeonPlayerSpawnBinding;
  const runtime=createDungeonRuntime(doc,spawn),engine=runtime.movementResolver;
  engine.externallyDriven=true;let completed=0;
  const events:string[]=[];
  const start=()=>engine.requestMove({actorId:'$dungeon-player',direction:runtime.playerPosition.tileX===1?'east':'west',durationSeconds:duration});
  const project=()=>{
    if(engine.samples.get('$dungeon-player')?.completed){events.push(`rule:${++completed}`);events.push('continue');start();}
  };
  return {runtime,engine,spawn,events,start,project,get completed(){return completed;}};
}

test('128 is a cooperative work budget; remaining time drains without loss or duplicate rules',()=>{
  const f=fixture();f.start();
  let result=f.engine.tick(120,f.project),total=result.consumedSeconds;
  assert.equal(result.yielded,true);assert.equal(result.boundaries,128);assert.ok(result.remainingSeconds>0);
  assert.equal(f.engine.storage.timing!.pendingSeconds,result.remainingSeconds);
  for(let frame=0;result.remainingSeconds>0&&frame<30;frame++) {
    result=f.engine.tick(0,f.project);total+=result.consumedSeconds;assert.equal(result.stall,undefined);
  }
  assert.equal(result.remainingSeconds,0);assert.ok(Math.abs(total-120)<1e-9);
  assert.ok(Math.abs(f.engine.storage.simulationSeconds!-120)<1e-9);assert.equal(f.completed,480);
  assert.equal(f.events.length,960);
});

test('one-boundary frames match an uninterrupted run, and newly arrived time is queued once',()=>{
  const split=fixture(),whole=fixture();split.start();whole.start();
  let result=split.engine.tick(2,split.project,undefined,{maxBoundaries:1});
  assert.deepEqual(split.events,[],'First boundary is the commit, not completion');
  result=split.engine.tick(.25,split.project,undefined,{maxBoundaries:1});
  assert.deepEqual(split.events,['rule:1','continue'],'Completion rules run before yielding');
  for(let i=0;result.remainingSeconds>0&&i<30;i++)result=split.engine.tick(0,split.project,undefined,{maxBoundaries:1});
  whole.engine.tick(2.25,whole.project,undefined,{maxBoundaries:1000});
  assert.deepEqual(split.events,whole.events);assert.equal(split.runtime.playerPosition.tileX,whole.runtime.playerPosition.tileX);
  assert.equal(split.engine.storage.simulationSeconds,2.25);assert.equal(result.remainingSeconds,0);
});

test('pause does not accumulate new wall time and preserves the existing remainder',()=>{
  const f=fixture();f.start();const first=f.engine.tick(2,f.project,undefined,{maxBoundaries:1});
  const paused=f.engine.tick(100,f.project,()=>false);
  assert.equal(paused.paused,true);assert.equal(paused.remainingSeconds,first.remainingSeconds);assert.equal(paused.consumedSeconds,0);
  f.engine.tick(0,f.project,()=>true,{maxBoundaries:1000});assert.equal(f.engine.storage.simulationSeconds,2);
});

test('yielding never splits cooperative occupancy commits or duplicates their completion rules',()=>{
  for(const kind of ['push','swap'] as const) {
    const runtime=createDungeonRuntime(createSpatialExampleDocument(kind),{tilePosition:{x:1,y:2},worldPosition:[1,0,2]} as unknown as DungeonPlayerSpawnBinding);
    const engine=runtime.movementResolver;engine.externallyDriven=true;let rules=0,commits=0;
    const ids=kind==='push'?['$dungeon-player','box']:['box','peer'];
    const destinations=kind==='push'?[16,17]:[17,16];
    runtime.traversal.subscribe(change=>{if(change.kind==='actor-moved'){
      commits++;ids.forEach((id,index)=>assert.equal(runtime.traversal.body(id)!.tileIndex,destinations[index]));
    }});
    engine.subscribeGroupCompleted(()=>{rules++;ids.forEach((id,index)=>assert.equal(runtime.traversal.body(id)!.tileIndex,destinations[index]));});
    const group=kind==='push'?engine.requestPush('$dungeon-player','east',1):engine.requestSwap('box','peer',0,1);
    assert.equal(group.accepted,true);
    let result=engine.tick(3,undefined,undefined,{maxBoundaries:1});
    for(let frame=0;result.remainingSeconds>0&&frame<20;frame++)result=engine.tick(0,undefined,undefined,{maxBoundaries:1});
    assert.equal(result.remainingSeconds,0);assert.equal(commits,2);assert.equal(rules,1);
  }
});

test('genuine unchanged boundary/time records a diagnostic and pauses rather than throwing',()=>{
  const f=fixture();
  f.engine.storage.tracks!.set('broken-actor',{kind:'turn',elapsedSeconds:0,durationSeconds:.001,requestId:'broken-action'});
  const result=f.engine.tick(.016);
  assert.equal(result.yielded,false);assert.equal(result.paused,true);assert.equal(result.stall?.kind,'no-progress');
  assert.equal(result.stall?.actors[0].actorId,'broken-actor');assert.equal(result.stall?.actors[0].actionId,'broken-action');
  assert.equal(result.stall?.actors[0].boundarySeconds,.001);
  const elapsed=f.engine.storage.simulationSeconds;const again=f.engine.tick(1);
  assert.equal(again.consumedSeconds,0);assert.equal(f.engine.storage.simulationSeconds,elapsed);
});

test('a mirrored move track and a legitimate collision wait are not mistaken for a stuck independent clock',()=>{
  const f=fixture(1);f.start();const request=f.engine.getActiveRequest('$dungeon-player')!;
  f.engine.storage.tracks!.set('$dungeon-player',{kind:'move',requestId:request.id,elapsedSeconds:.9999999,durationSeconds:1});
  const moving=f.engine.tick(.99);assert.equal(moving.stall,undefined);assert.equal(moving.boundaries,2);
  const world=f.runtime.traversal;
  world.registerActor({id:'intruder',kind:'dynamic',tileIndex:3,enabled:true,blocksMovement:true,movementProfileId:'ground'});
  const intruder=world.body('intruder')!;intruder.pose={x:2.2,y:0};indexSpatialBody(world.spatial,intruder);
  const waiting=f.engine.tick(.1,undefined,undefined,{maxBoundaries:2});
  assert.equal(waiting.stall,undefined);assert.equal(waiting.yielded,true);assert.equal(request.elapsedSeconds,.99);
});

test('an expired zero-duration independent track must also clear instead of remaining active forever',()=>{
  const f=fixture();f.engine.storage.tracks!.set('expired',{kind:'turn',elapsedSeconds:0,durationSeconds:0});
  assert.equal(f.engine.tick(.016).stall,undefined);
  assert.equal(f.engine.tick(.016).stall?.reason,'independent-track');
});

test('safe restore clears queued time and diagnostics instead of reviving a broken action',()=>{
  const f=fixture();const saved=createDungeonRuntimeSaveState('budget',f.runtime,f.spawn)??{version:2 as const,dungeonPresetKey:'budget'};
  f.engine.storage.tracks!.set('broken',{kind:'turn',elapsedSeconds:0,durationSeconds:.001});f.engine.tick(.016);
  applyDungeonRuntimeSaveState(f.runtime,saved,p=>[p.tileX,0,p.tileY]);
  assert.equal(f.engine.storage.timing!.pendingSeconds,0);assert.equal(f.engine.storage.timing!.stall,undefined);
  assert.equal(f.engine.tick(.016).paused,false);
});
