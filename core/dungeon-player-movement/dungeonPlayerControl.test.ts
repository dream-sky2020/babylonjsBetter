import assert from 'node:assert/strict';
import test from 'node:test';
import type { DungeonRuntime } from '../dungeon-runtime/dungeonRuntime.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTraversalWorld, DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/index.ts';
import { createDungeonMovementResolver } from '../dungeon-movement/index.ts';
import { startDungeonPlayerMovement, startDungeonPlayerRelativeMovement, startDungeonPlayerTurn, updateDungeonPlayerMovement } from './dungeonPlayerMovement.ts';
import { createDungeonPlayerControl } from './dungeonPlayerControl.ts';
import type { DungeonPlayerSystem } from './dungeonPlayerSystem';

const session = () => {
  const document = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test',
    map: createDungeonMapData({ id: 'test', width: 4, height: 1 }) }).document;
  const map = createDungeonRuntimeMap(document), traversal = createDungeonTraversalWorld(map);
  traversal.registerActor({ id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, kind: 'player', tileIndex: 0, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  const runtime: DungeonRuntime = { map, traversal, movementResolver: createDungeonMovementResolver(traversal), obstacles: [],
    playerPosition: { tileX: 0, tileY: 0 }, playerFacing: 'east', playerWorldPosition: [0, 0, 0], playerWorldRotationY: Math.PI / 2,
    playerMovement: null, obstacleStates: new Map() };
  const system: Pick<DungeonPlayerSystem, 'move' | 'moveRelative' | 'turn' | 'update' | 'isBusy' | 'subscribeGroupStep'> = {
    get isBusy() { return runtime.movementResolver.isBusy(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID); },
    subscribeGroupStep() { return () => {}; },
    move(...args) { assert.equal(this, system); return { ...startDungeonPlayerMovement(runtime, ...args), stopContinuation: false }; },
    moveRelative(...args) { assert.equal(this, system); return { ...startDungeonPlayerRelativeMovement(runtime, ...args), stopContinuation: false }; },
    turn(...args) { assert.equal(this, system); return startDungeonPlayerTurn(runtime, ...args); },
    update(delta) { assert.equal(this, system); return { ...updateDungeonPlayerMovement(runtime, delta), stopContinuation: false }; },
  };
  return { loadId: 1, runtime, system };
};

test('player facade preserves command receiver and Core movement/turn/relative behavior', () => {
  const active = session(), commands = createDungeonPlayerControl(() => active).acquire(1)!;
  assert.equal('runtime' in commands, false);
  const options = { teleport: true, resolveWorldPosition: (p: { tileX: number; tileY: number }) => [p.tileX * 8, 0, p.tileY * 8] as const };
  assert.equal(commands.move('east', options).completed, true); assert.equal(active.runtime.playerPosition.tileX, 1);
  assert.equal(commands.moveRelative('backward', options).completed, true); assert.equal(active.runtime.playerPosition.tileX, 0);
  assert.equal(commands.turn('right', { teleport: true }).completed, true); assert.equal(active.runtime.playerFacing, 'south');
  assert.equal(commands.update(0.1).completed, false);
});

test('teleport and profile commands retain bounds validation, occupancy and same live authority', () => {
  const active = session(), commands = createDungeonPlayerControl(() => active).acquire(1)!;
  commands.setMovementProfile('ground-eight-way');
  assert.equal(active.runtime.traversal.actors.get(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID)!.movementProfileId, 'ground-eight-way');
  commands.teleport({ tileX: 2, tileY: 0 }, [16, 0, 0]);
  assert.deepEqual(active.runtime.playerWorldPosition, [16, 0, 0]);
  assert.equal(active.runtime.traversal.occupantIdsByTile[2].has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), true);
  assert.throws(() => commands.teleport({ tileX: 99, tileY: 0 }, [99, 0, 0]), RangeError);
  assert.equal(active.runtime.playerPosition.tileX, 2); assert.equal(commands.inspect('east', {}).blockedReason, undefined);
});

test('cached player commands cannot operate after map replacement or disposal', () => {
  let active: ReturnType<typeof session> | null = session(); const control = createDungeonPlayerControl(() => active);
  const commands = control.acquire(1)!; assert.equal(control.acquire(2), null);
  active = { ...session(), loadId: 2 };
  assert.throws(() => commands.move('east', { teleport: true, resolveWorldPosition: () => [0, 0, 0] }), /地图已切换/);
  assert.throws(() => commands.update(1), /地图已切换/); assert.throws(() => commands.setMovementProfile('ground'), /地图已切换/);
  assert.throws(() => commands.isBusy, /地图已切换/);
  assert.equal(active.runtime.playerPosition.tileX, 0); active = null;
  assert.equal(control.acquire(2), null); assert.throws(() => commands.teleport({ tileX: 0, tileY: 0 }, [0, 0, 0]), /地图已切换/);
});
