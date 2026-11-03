import test from 'node:test';
import assert from 'node:assert/strict';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime, setDungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.ts';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import { resolveDungeonPlayerArrival } from '../dungeon-player-spawn/dungeonPlayerArrival.ts';
import { createDungeonAgentRuntimeState } from '../dungeon-agent/dungeonAgent.runtime.ts';
import { indexSpatialBody } from './dungeonSpatialGeometry.ts';

function fixture(width = 7, height = 7, topologyMode: 'bounded' | 'loop-horizontal' = 'bounded') {
  const agent = { id: 'guard', entityType: 'dungeon-agent', components: [
    { id: 'guard:grid', type: 'grid-agent', version: 1, initialFacing: 'east', blocksMovement: true,
      actionPeriod: 1, priority: 0, movementProfileId: 'ground' },
    { id: 'guard:controller', type: 'agent-controller', version: 1, controllerId: 'stationary', parameters: {} },
  ] };
  const x = Math.floor(width / 2), y = Math.floor(height / 2);
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'arrival', name: 'Arrival',
    map: createDungeonMapData({ id: 'arrival', width, height, mode: topologyMode,
      createTileData: position => position.x === x && position.y === y ? createEntityContainer(agent) : undefined }) }).document;
  const spawn = { tilePosition: { x, y }, worldPosition: [x * 10, 0, y * 10] } as unknown as DungeonPlayerSpawnBinding;
  const runtime = createDungeonRuntime(document, spawn, 'east');
  const agents = createDungeonAgentRuntimeState(runtime.map, runtime.traversal, runtime.movementResolver);
  runtime.movementResolver.externallyDriven = true;
  return { runtime, world: runtime.traversal, engine: runtime.movementResolver, agents, x, y };
}

test('arrival prefers the facing-side empty tile and synchronizes logical, spatial and world positions', () => {
  const { runtime, world, x, y } = fixture();
  resolveDungeonPlayerArrival(runtime, { resolveWorldPosition: (x, y) => [x * 10, 0, y * 10] });
  assert.deepEqual(runtime.playerPosition, { tileX: x + 1, tileY: y });
  assert.deepEqual(runtime.playerWorldPosition, [(x + 1) * 10, 0, y * 10]);
  assert.deepEqual(world.body('$dungeon-player')!.pose, { x: x + 1, y });
  assert.equal(world.occupantIdsByTile[y * 7 + x].has('$dungeon-player'), false);
  assert.equal(world.body('guard')!.tileIndex, y * 7 + x);
  assert.equal(runtime.playerFacing, 'east');
});

test('an empty original landing remains unchanged', () => {
  const { runtime, x, y } = fixture();
  setDungeonRuntimePlayerPosition(runtime, { tileX: x - 1, tileY: y });
  resolveDungeonPlayerArrival(runtime);
  assert.deepEqual(runtime.playerPosition, { tileX: x - 1, tileY: y });
});

test('arrival does not cross walls to find an empty tile', () => {
  const { runtime, world, x, y } = fixture();
  // Occupancy can change independently from the map document (restored/runtime barriers).
  const findStep = world.obstacleIndex.findStep;
  world.obstacleIndex.findStep = (from, to, direction) => direction === 'east'
    ? [{ entity: { id: 'wall', entityType: 'wall', components: [] }, component: { id: 'wall', type: 'movement-obstacle',
      version: 1, activeByDefault: true }, placement: { kind: 'tile', tileX: to.tileX, tileY: to.tileY } }]
    : findStep(from, to, direction);
  resolveDungeonPlayerArrival(runtime);
  assert.deepEqual(runtime.playerPosition, { tileX: x, tileY: y - 1 });
});

test('bounded search falls back to the occupied entrance with pair-specific escape', () => {
  const { runtime, world, engine, x, y } = fixture();
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  assert.deepEqual(runtime.playerPosition, { tileX: x, tileY: y });
  assert.ok(world.overlapEscapeIgnoreIds('$dungeon-player', { x, y }, { x: x + .1, y }).has('guard'));
  const move = engine.requestMove({ actorId: '$dungeon-player', direction: 'east', durationSeconds: 1 });
  assert.equal(move.accepted, true);
  engine.tick(.2);
  assert.ok(world.body('$dungeon-player')!.pose.x > x);
  assert.equal(world.body('$dungeon-player')!.tileIndex, y * 7 + x);
  assert.ok(world.overlapEscapeIgnoreIds('$dungeon-player', world.body('$dungeon-player')!.pose, { x: x + .3, y }).has('guard'));
  engine.tick(.8);
  assert.equal(world.body('$dungeon-player')!.tileIndex, y * 7 + x + 1);
  assert.equal(world.overlapEscapeIgnoreIds('$dungeon-player', { x: x + 1, y }, { x, y }).size, 0);
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'west', durationSeconds: 1 }).blockedReason, 'occupied');
});

test('either character may escape, including multiple overlapping partners', () => {
  const { runtime, world, engine, x, y } = fixture();
  world.registerActor({ id: 'second', kind: 'agent', tileIndex: 0, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  world.moveActor('second', y * 7 + x, undefined, { ignoreDynamicOccupancy: true });
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  assert.equal(world.overlapEscapeIgnoreIds('guard', { x, y }, { x, y: y + .1 }).size, 2);
  assert.equal(engine.requestMove({ actorId: 'guard', direction: 'south', durationSeconds: 1 }).accepted, true);
  engine.tick(1);
  assert.equal(world.body('guard')!.tileIndex, (y + 1) * 7 + x);
  assert.equal(world.overlapEscapeIgnoreIds('guard', { x, y: y + 1 }, { x, y }).size, 0);
});

test('escape does not disable collision against a third character or a fixed prop', () => {
  const { runtime, world, engine, x, y } = fixture();
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  world.registerActor({ id: 'third', kind: 'agent', tileIndex: y * 7 + x + 1,
    enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'east', durationSeconds: 1 }).blockedReason, 'occupied');
  world.unregisterActor('third');
  world.registerActor({ id: 'wall', kind: 'dynamic', tileIndex: 0, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  const wall = world.body('wall')!; wall.mobility = 'fixed'; wall.pose = { x: x + .3, y }; indexSpatialBody(world.spatial, wall);
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'east', durationSeconds: 1 }).accepted, true);
  engine.tick(1);
  assert.equal(world.body('$dungeon-player')!.tileIndex, y * 7 + x);
  assert.equal(world.overlapEscapeIgnoreIds('$dungeon-player', { x, y }, { x: x + .1, y }).has('wall'), false);
});

test('a fully occupied tiny map remains loadable without a timer forcing collisions back on', () => {
  const { runtime, world, engine } = fixture(1, 1);
  resolveDungeonPlayerArrival(runtime);
  engine.tick(10);
  assert.equal(world.overlapEscapeIgnoreIds('$dungeon-player', { x: 0, y: 0 }, { x: .1, y: 0 }).has('guard'), true);
});

test('overlap permissions are local to a session and removed when a partner is deleted', () => {
  const { runtime, world, x, y } = fixture();
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  world.unregisterActor('guard');
  assert.equal(world.overlapEscapeIgnoreIds('$dungeon-player', { x, y }, { x: x + .1, y }).size, 0);
  const fresh = fixture();
  assert.equal(fresh.world.overlapEscapeIgnoreIds('$dungeon-player', { x, y }, { x: x + .1, y }).size, 0);
});

test('permissions persist until physical separation even after logical commit', () => {
  const { runtime, world, engine, x, y } = fixture();
  const guard = world.body('guard')!;
  const collider = world.spatial.colliders.get(guard.colliderIds[0])!;
  collider.shape = 'box'; collider.halfWidth = .5; collider.halfHeight = .5;
  indexSpatialBody(world.spatial, guard);
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'east', durationSeconds: 1 }).accepted, true);
  engine.tick(.5);
  assert.equal(world.body('$dungeon-player')!.tileIndex, y * 7 + x + 1);
  assert.equal(world.overlapEscapeIgnoreIds('$dungeon-player', { x: x + .5, y }, { x: x + .6, y }).has('guard'), true);
  engine.tick(.3);
  assert.equal(world.overlapEscapeIgnoreIds('$dungeon-player', { x: x + .8, y }, { x: x + .9, y }).size, 0);
});

test('an interrupted escape rolls back without getting stuck against its original partner', () => {
  const { runtime, world, engine, x, y } = fixture();
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'east', durationSeconds: 1 }).accepted, true);
  engine.tick(.2);
  world.registerActor({ id: 'rival', kind: 'agent', tileIndex: y * 7 + x + 2,
    enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  assert.equal(engine.requestMove({ actorId: 'rival', direction: 'west', durationSeconds: 1, basePriority: 100 }).accepted, true);
  engine.tick(.2);
  assert.equal(engine.getActiveRequest('$dungeon-player'), undefined);
  assert.deepEqual(world.body('$dungeon-player')!.pose, { x, y });
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'north', durationSeconds: 1 }).accepted, true);
  engine.tick(1);
  assert.equal(world.body('$dungeon-player')!.tileIndex, (y - 1) * 7 + x);
});

test('arrival follows looping topology across a seam', () => {
  const { runtime, world } = fixture(3, 1, 'loop-horizontal');
  world.moveActor('guard', 2, undefined, { ignoreDynamicOccupancy: true });
  world.moveActor('$dungeon-player', 2, undefined, { ignoreDynamicOccupancy: true });
  resolveDungeonPlayerArrival(runtime);
  assert.deepEqual(runtime.playerPosition, { tileX: 0, tileY: 0 });
});

test('fallback does not select or route through a tile portal', () => {
  const { runtime, x, y } = fixture();
  const doc = runtime.map.document;
  doc.entities.push({ id: 'portal', entityType: 'dungeon-exit' });
  (doc.components['spatial-attachment'] ??= []).push({ id: 'portal:attachment', entityId: 'portal',
    type: 'spatial-attachment', version: 1, targets: [{ kind: 'tile', tileId: doc.grid.tileIds[y * 7 + x + 1] }] });
  (doc.components['dungeon-exit'] ??= []).push({ id: 'portal:exit', entityId: 'portal', type: 'dungeon-exit', version: 2,
    targetMapPresetKey: 'arrival', targetEntranceId: 'main', triggers: ['enter'] });
  resolveDungeonPlayerArrival(runtime);
  assert.deepEqual(runtime.playerPosition, { tileX: x, tileY: y - 1 });
});

test('idle movement also captures unexpected runtime overlap without a scene transition', () => {
  const { world, engine, x, y } = fixture();
  assert.equal(engine.requestMove({ actorId: '$dungeon-player', direction: 'east', durationSeconds: 1 }).accepted, true);
  engine.tick(1);
  assert.equal(world.body('$dungeon-player')!.tileIndex, y * 7 + x + 1);
});

test('an overlapping player can escape by pushing a neighbouring prop', () => {
  const { runtime, world, engine, x, y } = fixture();
  resolveDungeonPlayerArrival(runtime, { radius: 0 });
  world.registerActor({ id: 'box', kind: 'dynamic', tileIndex: y * 7 + x + 1,
    enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  const push = engine.requestPush('$dungeon-player', 'east', 1);
  assert.equal(push.accepted, true);
  engine.tick(push.durationSeconds!);
  assert.equal(world.body('$dungeon-player')!.tileIndex, y * 7 + x + 1);
  assert.equal(world.body('box')!.tileIndex, y * 7 + x + 2);
  assert.equal(world.body('guard')!.tileIndex, y * 7 + x);
});

test('an invalid static entrance cannot be excused by character overlap permissions', () => {
  const { runtime, world, x, y } = fixture();
  world.registerActor({ id: 'wall', kind: 'dynamic', tileIndex: 0,
    enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  const wall = world.body('wall')!;
  wall.mobility = 'fixed'; wall.pose = { x, y }; indexSpatialBody(world.spatial, wall);
  assert.throws(() => resolveDungeonPlayerArrival(runtime, { radius: 0 }), /没有合法落点/);
});
