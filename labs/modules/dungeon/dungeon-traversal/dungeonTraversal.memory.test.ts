import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import { createDungeonTraversalControl } from '../../../../core/dungeon-traversal/dungeonTraversalControl.ts';
import type { DungeonTraversalChange } from '../../../../core/dungeon-traversal/dungeonTraversal.ts';
import { DUNGEON_TRAVERSAL_STATE_MEMORY, createDungeonTraversalStateData } from './dungeonTraversal.memory.ts';

const source = () => ({
  actors: new Map([['player', { id: 'player', kind: 'player' as const, tileIndex: 0, enabled: true, blocksMovement: true, movementProfileId: 'ground' }]]),
  occupantIdsByTile: [new Set(['player']), new Set<string>()],
  pathReservationsByTile: [new Map<string, number>(), new Map([['agent', 1]])],
});

test('traversal consumers share Core collections and observe actor/occupancy/reservation changes without copying', () => {
  const registry = new LabMemoryRegistry(), reader = registry.scope('dungeon-traversal').acquire(DUNGEON_TRAVERSAL_STATE_MEMORY);
  const publisher = registry.scope('loader').acquire(DUNGEON_TRAVERSAL_STATE_MEMORY), world = source();
  assert.equal(reader, publisher); assert.equal(reader.current, null);
  const data = createDungeonTraversalStateData(1, 'a', world); publisher.replace(data);
  assert.equal(data.actors, world.actors); assert.equal(data.occupantIdsByTile, world.occupantIdsByTile);
  assert.equal(data.pathReservationsByTile, world.pathReservationsByTile);
  world.actors.get('player')!.tileIndex = 1; world.occupantIdsByTile[0].clear(); world.occupantIdsByTile[1].add('player');
  world.pathReservationsByTile[1].set('agent', 2);
  assert.equal(reader.require().actors.get('player')!.tileIndex, 1);
  assert.deepEqual([...reader.require().occupantIdsByTile[1]], ['player']);
  assert.equal(reader.require().pathReservationsByTile[1].get('agent'), 2);
  const debug = registry.inspectValue(publisher.key) as typeof data;
  assert.equal(debug.actors, world.actors); assert.equal(debug.occupantIdsByTile, world.occupantIdsByTile);
  assert.equal(debug.pathReservationsByTile, world.pathReservationsByTile);
  for (const key of ['runtime', 'map', 'obstacles', 'inspectStep', 'subscribe']) assert.equal(key in data, false);
});

test('candidate validation preserves old traversal data, switches the stable handle and releases it', () => {
  const registry = new LabMemoryRegistry(), handle = registry.scope('loader').acquire(DUNGEON_TRAVERSAL_STATE_MEMORY);
  const first = createDungeonTraversalStateData(1, 'a', source()); handle.replace(first);
  const invalid = source(); invalid.pathReservationsByTile.pop();
  assert.throws(() => handle.replace(createDungeonTraversalStateData(2, 'bad', invalid)), /替换失败/);
  assert.equal(handle.current, first);
  const badActor = source(); badActor.actors.get('player')!.tileIndex = NaN;
  assert.throws(() => handle.replace(createDungeonTraversalStateData(2, 'bad', badActor)), /替换失败/);
  const second = createDungeonTraversalStateData(3, 'b', source()); handle.replace(second);
  assert.equal(handle.current, second); handle.replace(null); assert.equal(handle.current, null);
});

test('capabilities preserve receiver/arguments, ignore stale commands and notifications, and detach subscriptions', () => {
  const listeners = new Set<(change: DungeonTraversalChange) => void>();
  let calls = 0;
  const world = {
    inspectStep(actorId: string, from: number, direction: string) {
      assert.equal(this, world); assert.equal(actorId, 'player'); assert.equal(from, 0); assert.equal(direction, 'east');
      calls++; return { toTileIndex: 1, blockingEntityIds: [] };
    },
    subscribe(listener: (change: DungeonTraversalChange) => void) {
      assert.equal(this, world); listeners.add(listener); return () => { listeners.delete(listener); };
    },
  };
  let active: { loadId: number; traversal: typeof world } | null = { loadId: 1, traversal: world };
  const control = createDungeonTraversalControl(() => active), changes: string[] = [];
  const off = control.subscribe(1, change => changes.push(change.kind));
  assert.equal(control.inspectStep(1, 'player', 0, 'east')?.toTileIndex, 1);
  listeners.forEach(fn => fn({ kind: 'actor-moved', actorId: 'player' })); assert.deepEqual(changes, ['actor-moved']);
  active = { loadId: 2, traversal: world };
  assert.equal(control.inspectStep(1, 'player', 0, 'east'), null); assert.equal(calls, 1);
  listeners.forEach(fn => fn({ kind: 'actor-moved' })); assert.equal(changes.length, 1);
  control.subscribe(1, () => assert.fail('stale listener'))(); assert.equal(listeners.size, 1);
  off(); assert.equal(listeners.size, 0); active = null;
  assert.equal(control.inspectStep(2, 'player', 0, 'east'), null);
});
