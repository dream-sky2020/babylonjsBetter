import assert from 'node:assert/strict';
import test from 'node:test';
import { LabFrameClock } from './labFrameClock.ts';
import { createDungeonMapData } from '../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../../core/dungeon-runtime/dungeonRuntime.ts';
import type { DungeonPlayerSpawnBinding } from '../../core/dungeon-player-spawn';

test('foreground deltas pass through; hidden time and the resume frame do not simulate',()=>{
  const clock=new LabFrameClock();
  assert.equal(clock.next(8,false),0);assert.equal(clock.next(.016,false),.016);
  assert.equal(clock.next(3600,true),null);assert.equal(clock.next(.1,true),null);
  assert.equal(clock.next(3600,false),0);assert.equal(clock.next(.02,false),.02);
  clock.reset();assert.equal(clock.next(.03,false),0);assert.equal(clock.next(.03,false),.03);
});

test('sleep without a visibility event is treated as suspension, not a catch-up frame',()=>{
  const clock=new LabFrameClock();clock.next(0,false);
  assert.equal(clock.next(7200,false),0);assert.equal(clock.next(.016,false),.016);
  assert.throws(()=>clock.next(NaN,false),RangeError);assert.throws(()=>clock.next(-1,false),RangeError);
});

test('background catch-up would exhaust the action budget; the Lab clock prevents that work',()=>{
  const build=()=>{
    const doc=migrateDungeonMapToDocumentV2({presetKey:'clock',name:'clock',map:createDungeonMapData({id:'clock',width:6,height:1})}).document;
    const runtime=createDungeonRuntime(doc,{tilePosition:{x:1,y:0},worldPosition:[1,0,0]} as unknown as DungeonPlayerSpawnBinding);
    const engine=runtime.movementResolver;engine.externallyDriven=true;
    const start=()=>engine.requestMove({actorId:'$dungeon-player',direction:runtime.playerPosition.tileX===1?'east':'west',durationSeconds:.1});
    start();
    return {engine,project:()=>{if(engine.samples.get('$dungeon-player')?.completed)start();}};
  };
  const original=build();const budget=original.engine.tick(120,original.project);
  assert.equal(budget.yielded,true);assert.ok(budget.remainingSeconds>0);
  const {engine,project}=build(),clock=new LabFrameClock();clock.next(0,false);
  engine.tick(clock.next(.016,false)!,project);const before=engine.getActiveRequest('$dungeon-player')!.elapsedSeconds;
  assert.equal(clock.next(3600,true),null);clock.reset();engine.tick(clock.next(3600,false)!,project);
  assert.equal(engine.getActiveRequest('$dungeon-player')!.elapsedSeconds,before);
  engine.tick(clock.next(.016,false)!,project);
  assert.ok(Math.abs(engine.getActiveRequest('$dungeon-player')!.elapsedSeconds-before-.016)<1e-9);
});
