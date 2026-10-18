import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { DungeonMapDocumentStore } from '../map-document/dungeonMapDocument.store.ts';
import { encodeDungeonMapDocumentV3, parseDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { createDungeonMapDocumentDelta, applyDungeonMapDocumentDelta } from '../map-document/dungeonMapDocument.delta.ts';
import { componentDefinition as interaction } from '../entity/components/spatial-interaction.component.ts';
import { createSpatialExampleDocument } from './dungeonSpatialExample.ts';
import { compileSpatialDefinitions } from './dungeonSpatialDefinition.ts';
import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { startDungeonPlayerMovement } from '../dungeon-player-movement/dungeonPlayerMovement.ts';
import { DungeonPlayerSystem } from '../dungeon-player-movement/dungeonPlayerSystem.ts';
import { DungeonPlayerStepEvents } from '../dungeon-player-movement/dungeonPlayerStepEvents.ts';

const options = { movementTimingMode: 'seconds-per-tile' as const, movementSecondsPerTile: 1,
  resolveWorldPosition: (p: { tileX: number; tileY: number }) => [p.tileX, 0, p.tileY] as const };

function fixture(response?: 'block' | 'push' | 'swap', disabled = false) {
  const doc = createSpatialExampleDocument('push');
  if (response) doc.components['spatial-interaction'] = [{ ...interaction.createDefault(),
    id: 'box:interaction', entityId: 'box', onPlayerPush: response, enabled: !disabled }];
  const spawn = { tilePosition: { x: 1, y: 2 }, worldPosition: [1, 0, 2] } as unknown as DungeonPlayerSpawnBinding;
  const runtime = createDungeonRuntime(doc, spawn, 'east');
  runtime.movementResolver.externallyDriven = true;
  return { doc, runtime, engine: runtime.movementResolver };
}

test('interaction component is optional, unique, validated and editable through map history, delta and v3', () => {
  assert.equal(interaction.createDefault().onPlayerPush, 'block');
  assert.deepEqual(interaction.fields[0].options?.map(option => option.value), ['block', 'swap', 'push']);
  assert.ok(interaction.allowedEntityTypes?.includes('spatial-object'));
  assert.equal(interaction.allowMultiple, false);
  const { doc } = fixture();
  const store = new DungeonMapDocumentStore(doc);
  store.addComponent({ ...interaction.createDefault(), id: 'interaction', entityId: 'box' });
  store.updateComponent('interaction', { onPlayerPush: 'push' });
  assert.equal(compileSpatialDefinitions(store.getDocument()).bodies.find(body => body.entityId === 'box')!.interaction!.onPlayerPush, 'push');
  store.undo();assert.equal(store.getDocument().components['spatial-interaction'][0].onPlayerPush, 'block');
  store.redo();
  const edited = store.getDocument();
  const restored = parseDungeonMapDocumentV3(encodeDungeonMapDocumentV3(edited));
  assert.deepEqual(restored.components['spatial-interaction'], edited.components['spatial-interaction']);
  const delta = createDungeonMapDocumentDelta('spatial-example', doc, edited)!;
  assert.deepEqual(applyDungeonMapDocumentDelta(doc, delta).components['spatial-interaction'], edited.components['spatial-interaction']);
});

test('invalid interaction values, duplicate components, missing bodies and incompatible capabilities are rejected', () => {
  const { doc } = fixture('push');
  const row = doc.components['spatial-interaction'][0];
  for (const patch of [{ onPlayerPush: 'unknown' }, { onPlayerPush: 'push-or-swap' }, { version: 2 }]) {
    const candidate = structuredClone(doc);Object.assign(candidate.components['spatial-interaction'][0], patch);
    assert.ok(compileSpatialDefinitions(candidate).issues.length);
  }
  doc.components['spatial-interaction'].push({ ...row, id: 'duplicate' });
  assert.ok(compileSpatialDefinitions(doc).issues.some(issue => issue.message.includes('只能有一个')));
  doc.components['spatial-interaction'].pop();
  const body = doc.components['spatial-body'].find(body => body.entityId === 'box')!;
  body.pushable = false;
  assert.ok(compileSpatialDefinitions(doc).issues.some(issue => issue.message.includes('允许推动')));
  row.onPlayerPush = 'swap';assert.deepEqual(compileSpatialDefinitions(doc).issues, []);
  body.mobility = 'fixed';assert.ok(compileSpatialDefinitions(doc).issues.some(issue => issue.message.includes('可移动')));
  row.enabled = false;assert.deepEqual(compileSpatialDefinitions(doc).issues, []);
  const bare = migrateDungeonMapToDocumentV2({ presetKey: 'bare', name: 'bare', map: createDungeonMapData({ id: 'bare', width: 2, height: 2 }) }).document;
  bare.entities.push({ id: 'bare', entityType: 'spatial-object' });
  bare.components['spatial-interaction'] = [{ ...interaction.createDefault(), entityId: 'bare' }];
  assert.ok(compileSpatialDefinitions(bare).issues.some(issue => issue.message.includes('缺少所属 Body')));
});

test('walking into configured objects submits a push or swap, with atomic occupancy and no ordinary bump track', () => {
  for (const response of ['push', 'swap'] as const) {
    const { runtime, engine } = fixture(response);
    const result = startDungeonPlayerMovement(runtime, 'east', {...options,swapDurationSeconds:1});
    assert.equal(result.started, true);assert.equal(result.actionKind, response);
    assert.equal(runtime.playerMovement, null);assert.equal(engine.activeRequests.size, 0);
    assert.equal(startDungeonPlayerMovement(runtime, 'east', options).blockedReason, 'movement-in-progress');
    engine.tick(result.actionDurationSeconds!/2);assert.equal(runtime.playerPosition.tileX, response === 'push' ? 2 : 1);
    assert.equal(runtime.traversal.body('box')!.logicalPosition.tileX, response === 'push' ? 3 : 2);
    engine.tick(result.actionDurationSeconds!/2);assert.equal(engine.isBusy('$dungeon-player'), false);assert.equal(runtime.playerPosition.tileX,2);
    assert.equal(runtime.traversal.body('box')!.logicalPosition.tileX,response === 'push'?3:1);
  }
});

test('absent, blocked or disabled responses retain blocked movement; existing interceptors retain priority', () => {
  for (const [response, disabled] of [[undefined, false], ['block', false], ['push', true]] as const) {
    const { runtime, engine } = fixture(response, disabled);
    const result = startDungeonPlayerMovement(runtime, 'east', options);
    assert.equal(result.blockedReason, 'movement-obstacle');assert.equal(runtime.playerMovement!.kind, 'blocked');
    assert.equal(engine.storage.groups!.size, 0);
  }
  const { runtime, engine } = fixture('push');
  const result = startDungeonPlayerMovement(runtime, 'east', { ...options, onBlockedAttempt: () => true });
  assert.equal(result.handled, true);assert.equal(engine.storage.groups!.size, 0);
});

test('a busy or higher-priority swap target reports refusal without a false bump animation', () => {
  const busy = fixture('swap');
  busy.engine.storage.tracks!.set('box', { kind: 'turn', durationSeconds: 1 });
  const refused = startDungeonPlayerMovement(busy.runtime, 'east', options);
  assert.equal(refused.started, false);
  assert.equal(refused.interactionFailure?.reason, 'movement-in-progress');
  assert.equal(busy.runtime.playerMovement, null);

  const priority = fixture('swap');
  const old = priority.engine.requestMove({ actorId: 'box', direction: 'south', durationSeconds: 1, basePriority: 2000 });
  assert.equal(old.accepted, true);
  const lower = startDungeonPlayerMovement(priority.runtime, 'east', options);
  assert.equal(lower.started, false);
  assert.equal(lower.interactionFailure?.reason, 'priority-conflict');
  assert.equal(priority.runtime.playerMovement, null);
  assert.equal(priority.engine.getActiveRequest('box')?.id, old.request?.id);
});

test('blocked push destinations do not fall back; adjacent scenery does not block a straight swap', () => {
  const push = fixture('push');push.runtime.traversal.moveActor('peer', 17);
  const pushResult = startDungeonPlayerMovement(push.runtime, 'east', options);
  assert.equal(pushResult.blockedReason, 'movement-obstacle');
  assert.equal(pushResult.interactionFailure?.kind, 'push');
  assert.equal(pushResult.interactionFailure?.reason, 'blocked');
  assert.equal(push.engine.storage.groups!.size, 0);assert.equal(push.runtime.playerPosition.tileX, 1);
  const swap = fixture('swap');swap.runtime.traversal.moveActor('peer', 23);
  const swapResult = startDungeonPlayerMovement(swap.runtime, 'east', options);
  assert.equal(swapResult.actionKind, 'swap');
  assert.equal(swap.engine.storage.groups!.size, 1);
});

test('automatic interaction emits one synchronous player step before observers and supports relative movement', () => {
  const { runtime, engine } = fixture('push');
  const steps = new DungeonPlayerStepEvents(), system = new DungeonPlayerSystem(runtime, 7, steps), order: string[] = [];
  steps.subscribe('transition', 100, event => { assert.equal(event.to.tileX, 2);order.push('transition');return true; });
  steps.subscribe('later-rule', 200, () => { order.push('later'); });
  const off = system.subscribeGroupStep(outcome => { assert.equal(outcome.stopContinuation, true);order.push('observe'); });
  const result = system.moveRelative('forward', { ...options, faceMovementDirection: false });
  assert.equal(result.actionKind, 'push');assert.equal(system.isBusy, true);
  engine.tick(1, delta => system.update(delta));engine.tick(1, delta => system.update(delta));
  assert.deepEqual(order, ['transition', 'observe']);assert.equal(runtime.playerFacing, 'east');off();
});

test('automatic swap uses initiator walking speed and emits one player step only after both final anchors commit',()=>{
  const {runtime,engine}=fixture('swap');
  const steps=new DungeonPlayerStepEvents(),system=new DungeonPlayerSystem(runtime,7,steps);let count=0;
  steps.subscribe('check-swap',100,()=>{
    count++;assert.equal(runtime.playerPosition.tileX,2);assert.equal(runtime.traversal.body('box')!.logicalPosition.tileX,1);
  });
  const result=system.moveRelative('forward',{...options,movementSecondsPerTile:9});
  assert.equal(result.actionDurationSeconds,9);
  engine.tick(result.actionDurationSeconds!/2);assert.equal(count,0);assert.equal(runtime.playerPosition.tileX,1);
  engine.tick(result.actionDurationSeconds!/2);assert.equal(count,1);engine.tick(1);assert.equal(count,1);
});

test('player swap overtakes a moving target without replaying its interrupted move',()=>{
  const {runtime,engine}=fixture('swap');
  const old=engine.requestMove({actorId:'box',direction:'south',durationSeconds:1,basePriority:2});
  assert.equal(old.accepted,true);
  engine.tick(.2);
  const before={...runtime.traversal.body('box')!.pose};
  const result=startDungeonPlayerMovement(runtime,'east',options);
  assert.equal(result.actionKind,'swap');
  assert.equal(result.started,true);
  assert.deepEqual(runtime.traversal.body('box')!.pose,before);
  assert.equal(engine.getActiveRequest('box'),undefined);
  engine.tick(result.actionDurationSeconds!);
  assert.equal(runtime.playerPosition.tileX,2);
  assert.equal(runtime.traversal.body('box')!.tileIndex,15);
});

test('automatic swap uses world-space presented distance only in world-speed mode',()=>{
  for(const mode of ['world-units-per-second','seconds-per-tile'] as const) {
    const {runtime,engine}=fixture('swap');
    const resolve=(p:{tileX:number;tileY:number})=>[p.tileX*8,0,p.tileY*12] as const;
    engine.worldPositionFor=(x,y)=>[x*8,0,y*12];
    const bodies=[runtime.traversal.body('$dungeon-player')!,runtime.traversal.body('box')!];
    bodies.forEach(body=>engine.projectBody(body));
    const result=startDungeonPlayerMovement(runtime,'east',{resolveWorldPosition:resolve,
      movementTimingMode:mode,movementSpeed:4,movementSecondsPerTile:.2});
    assert.equal(result.actionKind,'swap');
    const limit=mode==='seconds-per-tile'?40:4;
    if(mode==='seconds-per-tile')assert.equal(result.actionDurationSeconds,.2);
    else assert.ok(result.actionDurationSeconds!>2);
    const dt=result.actionDurationSeconds!/200;let peak=0;
    for(let i=0;i<200;i++) {
      const before=bodies.map(body=>mode==='seconds-per-tile'
        ? engine.worldPositionFor!(body.pose.x,body.pose.y) : [...body.worldPosition!]);engine.tick(dt);
      bodies.forEach((body,index)=>{
        const after=mode==='seconds-per-tile'?engine.worldPositionFor!(body.pose.x,body.pose.y):body.worldPosition!;
        const speed=Math.hypot(...after.map((value,axis)=>value-before[index][axis]))/dt;
        peak=Math.max(peak,speed);assert.ok(speed<=limit+1e-4,`${mode} body ${index}, sample ${i}: ${speed} > ${limit}`);
      });
    }
    assert.ok(peak>limit*.99);
    assert.equal(runtime.playerPosition.tileX,2);
    assert.equal(runtime.traversal.body('box')!.logicalPosition.tileX,1);
  }
});

test('world-speed swap can explicitly ignore sidestep distance without hiding the sidestep',()=>{
  const {runtime,engine}=fixture('swap');
  const resolve=(p:{tileX:number;tileY:number})=>[p.tileX*8,0,p.tileY*12] as const;
  engine.worldPositionFor=(x,y)=>[x*8,0,y*12];
  const bodies=[runtime.traversal.body('$dungeon-player')!,runtime.traversal.body('box')!];
  bodies.forEach(body=>engine.projectBody(body));
  const result=startDungeonPlayerMovement(runtime,'east',{resolveWorldPosition:resolve,
    movementTimingMode:'world-units-per-second',movementSpeed:4,swapIgnorePresentationDistance:true});
  assert.equal(result.actionDurationSeconds,2);
  const before=bodies.map(body=>[...body.worldPosition!]);
  engine.tick(.1);
  assert.ok(bodies.some((body,index)=>Math.hypot(...body.worldPosition!.map((value,axis)=>value-before[index][axis]))/.1>4));
  assert.ok(bodies[0].presentationOffset);
  engine.tick(1.9);
  assert.equal(runtime.playerPosition.tileX,2);
});

test('automatic push obeys the walking limit in world-speed and seconds-per-tile timing modes',()=>{
  for(const mode of ['world-units-per-second','seconds-per-tile'] as const) {
    const {runtime,engine}=fixture('push');
    const resolve=(p:{tileX:number;tileY:number})=>[p.tileX*8,0,p.tileY*12] as const;
    engine.worldPositionFor=(x,y)=>[x*8,0,y*12];
    const bodies=[runtime.traversal.body('$dungeon-player')!,runtime.traversal.body('box')!];bodies.forEach(body=>engine.projectBody(body));
    const result=startDungeonPlayerMovement(runtime,'east',{resolveWorldPosition:resolve,movementTimingMode:mode,movementSpeed:4,movementSecondsPerTile:.2});
    assert.equal(result.actionKind,'push');
    const tileSeconds=mode==='seconds-per-tile'?.2:2,limit=8/tileSeconds;
    assert.ok(Math.abs(result.actionDurationSeconds!-tileSeconds*1.5)<1e-9);
    const dt=result.actionDurationSeconds!/100;
    for(let i=0;i<101;i++) {
      const before=bodies.map(body=>[...body.worldPosition!]);engine.tick(dt);
      bodies.forEach((body,index)=>assert.ok(Math.hypot(...body.worldPosition!.map((value,axis)=>value-before[index][axis]))/dt<=limit+1e-7));
    }
    assert.equal(engine.isBusy('$dungeon-player'),false);assert.equal(runtime.playerPosition.tileX,2);
  }
});
